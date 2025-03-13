import json
import re
from django_countries import countries
from django.core.management.base import BaseCommand
import csv
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from profiles.models import Profile, Document
from treasury.models import ESNcard
import os


class Command(BaseCommand):
    help = 'Import profiles from a CSV file'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the CSV file')
        parser.add_argument('--dry-run', action='store_true', help='Run without saving to database')

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        file_path = options['file_path']
        country_codes_path = './countryCodes.json'

        result = self.import_profiles_from_csv(file_path, country_codes_path, dry_run)

        self.stdout.write(self.style.SUCCESS(f"Successfully imported {result['success_count']} profiles"))
        if result['error_count'] > 0:
            self.stdout.write(self.style.WARNING(f"Failed to import {result['error_count']} profiles"))
            for error in result['errors']:
                self.stdout.write(self.style.ERROR(error))

    def import_profiles_from_csv(self, file_path, country_codes_path, dry_run=False):
        """
        Import profiles from a CSV file.

        Args:
            file_path: Path to the CSV file
            country_codes_path: Path to the country codes JSON file
            dry_run: Whether to commit changes to the database
        """

        def load_country_codes(path):
            try:
                if not os.path.exists(path):
                    self.stdout.write(self.style.WARNING(f"Country codes file not found at {path}"))
                    return []

                with open(path, 'r', encoding='utf-8') as file:
                    return json.load(file)
            except json.JSONDecodeError as e:
                self.stdout.write(self.style.ERROR(f"Error parsing JSON data: {e}"))
                return []

        def map_country_to_code(name):
            if not name or name == "NULL" or name == "--":
                return None

            # Try exact match first
            for country in country_codes:
                if country['name'].lower() == name.lower():
                    code = country['code']
                    # Verify it's a valid code in django-countries
                    if code in dict(countries):
                        return code

            # Try partial match
            for country in country_codes:
                if name.lower() in country['name'].lower() or country['name'].lower() in name.lower():
                    code = country['code']
                    if code in dict(countries):
                        return code

            self.stdout.write(self.style.WARNING(f"Country not found: {name}"))
            return None

        def get_dial_code_by_country_name(name):
            if not name or name == "NULL" or name == "--":
                return None

            for country in country_codes:
                if country['name'].lower() == name.lower():
                    return country['dial']

            return None

        def parse_phone_number(phone_str, country_name=None):
            if not phone_str or phone_str == 'NULL' or phone_str == '--':
                return None, None

            # Strip spaces and any non-digit or plus characters
            phone_str = phone_str.strip()

            # If there's already a plus, use that format
            if phone_str.startswith('+'):
                # Try to match country code from our database
                for country in country_codes:
                    dial_code = country['dial']
                    if phone_str.startswith(dial_code):
                        number_part = phone_str[len(dial_code):]
                        return dial_code, int(number_part) if number_part.isdigit() else None

                # If we couldn't match a specific code, use a generic approach
                match = re.match(r'^\+(\d{1,4})(\d+)$', phone_str)
                if match:
                    prefix = '+' + match.group(1)
                    number = int(match.group(2))
                    return prefix, number
                else:
                    # If we can't match, just return with generic + prefix
                    return '+', int(phone_str[1:]) if phone_str[1:].isdigit() else None

            # Handle 00XX format (international)
            elif phone_str.startswith('00'):
                # Convert 00 to + format
                plus_format = '+' + phone_str[2:]
                # Try again with + format
                return parse_phone_number(plus_format, country_name)

            # If we have a country name, try to use its dial code
            elif country_name:
                dial_code = get_dial_code_by_country_name(country_name)
                if dial_code:
                    return dial_code, int(phone_str) if phone_str.isdigit() else None

            # Handle local numbers (no prefix)
            try:
                return None, int(phone_str) if phone_str.isdigit() else None
            except ValueError:
                return None, None

        success_count = 0
        error_count = 0
        errors = []

        # Document type mapping
        document_type_mapping = {
            'PA': Document.Type.PASSPORT,
            'ID': Document.Type.NATIONAL_ID,
        }

        country_codes = load_country_codes(country_codes_path)
        if not country_codes:
            errors.append(f"Failed to load country codes from {country_codes_path}")
            return {'success_count': 0, 'error_count': 1, 'errors': errors}

        with open(file_path, 'r', encoding='utf-8', errors='replace') as csv_file:
            # First detect actual headers
            csv_reader = csv.reader(csv_file, delimiter=',')
            headers = next(csv_reader)

            # Print headers for debugging
            self.stdout.write(f"CSV headers: {headers}")

            # Reset file pointer
            csv_file.seek(0)
            csv_reader = csv.DictReader(csv_file, delimiter=',')

            for row in csv_reader:
                try:
                    with transaction.atomic():
                        # Debug current row
                        if 'nome' in row:
                            self.stdout.write(f"Processing {row['nome']} {row['cognome']}")

                        # Parse birthdate
                        birthdate = None
                        try:
                            if 'data_nascita' in row and row['data_nascita']:
                                birthdate = datetime.strptime(row['data_nascita'], '%d/%m/%Y').date()
                        except ValueError:
                            pass

                        # Get country code
                        country_name = row.get('nazione', '')
                        country_code = map_country_to_code(country_name)

                        # Parse phone numbers with country context
                        phone_prefix, phone_number = parse_phone_number(row.get('telefono', ''), country_name)
                        whatsapp_prefix, whatsapp_number = parse_phone_number(row.get('whatsapp', ''), country_name)
                        if not whatsapp_prefix and not whatsapp_number and (phone_prefix or phone_number):
                            self.stdout.write(self.style.WARNING(f"No WhatsApp number for {row.get('nome', '')} {row.get('cognome', '')}, using phone number instead"))
                            whatsapp_prefix = phone_prefix
                            whatsapp_number = phone_number
                        # Parse matricola and person code
                        try:
                            matricola = row.get('matricola', '')
                            if matricola != 'NULL' and matricola.isdigit() and len(matricola) == 6:
                                matricola_number = int(matricola)
                            else:
                                matricola_number = None
                        except (ValueError, AttributeError):
                            matricola_number = None

                        try:
                            person_code = row.get('codice_persona', '')
                            if person_code != 'NULL' and person_code.isdigit() and len(person_code) == 8:
                                person_code = int(person_code)
                            else:
                                person_code = None
                        except (ValueError, AttributeError):
                            person_code = None

                        # Parse registration date
                        try:
                            created_at = datetime.strptime(row.get('data_iscrizione', ''), '%Y-%m-%d %H:%M:%S')
                        except ValueError:
                            created_at = timezone.now()

                        # Determine period end date
                        periodo = row.get('periodo_permanenza', '')
                        if periodo == '1':
                            end_date = '2025-01-31'
                        else:
                            end_date = '2025-07-31'

                        # Create Profile
                        profile = Profile(
                            email=row.get('email', ''),
                            name=row.get('nome', ''),
                            surname=row.get('cognome', ''),
                            birthdate=birthdate,
                            country=country_code,
                            phone_prefix=phone_prefix,
                            phone_number=phone_number,
                            whatsapp_prefix=whatsapp_prefix,
                            whatsapp_number=whatsapp_number,
                            person_code=person_code,
                            domicile=row.get('indirizzo_residenza', ''),
                            matricola_number=matricola_number,
                            matricola_expiration=datetime.strptime(end_date, '%Y-%m-%d').date(),
                            email_is_verified=True,
                            created_at=created_at
                        )

                        # Create Document if document data is available
                        document = None
                        documento = row.get('documento', '')
                        tipo_documento = row.get('tipo_documento', '')
                        if documento and documento != 'NULL' and tipo_documento in document_type_mapping:
                            try:
                                doc_date = row.get('data_documento', '')
                                doc_expiration = datetime.strptime(doc_date, '%d/%m/%Y').date() if doc_date else None
                            except ValueError:
                                doc_expiration = datetime.strptime('2030-01-01', '%Y-%m-%d').date()

                            document = Document(
                                profile=profile,
                                type=document_type_mapping.get(tipo_documento, Document.Type.OTHER),
                                number=documento,
                                expiration=doc_expiration
                            )

                        # Create ESNcard if card number is available
                        esncard = None
                        card_number = row.get('ESN_card', '')
                        if card_number and card_number != 'NULL':
                            esncard = ESNcard(
                                profile=profile,
                                number=card_number,
                                created_at=created_at
                            )

                        if not dry_run:
                            profile.save()
                            if document:
                                document.save()
                            if esncard:
                                esncard.save()

                        # Format profile data in a tabular way
                        def format_profile_table(profile_row):
                            # Create header and separator
                            header = f"{'FIELD':<20} | {'VALUE'}"
                            separator = f"{'-' * 20} | {'-' * 40}"

                            # Format each field
                            rows = [
                                f"{'Name':<20} | {str(profile_row.name)}",
                                f"{'Surname':<20} | {str(profile_row.surname)}",
                                f"{'Email':<20} | {str(profile_row.email)}",
                                f"{'Matricola':<20} | {str(profile_row.matricola_number or 'None')}",
                                f"{'Matricola Expires':<20} | {str(profile_row.matricola_expiration or 'None')}",
                                f"{'Person Code':<20} | {str(profile_row.person_code or 'None')}",
                                f"{'Phone':<20} | {f'{profile_row.phone_prefix or ''} - {profile_row.phone_number or ''}' if (profile_row.phone_prefix or profile_row.phone_number) else 'None'}",
                                f"{'WhatsApp':<20} | {f'{profile_row.whatsapp_prefix or ''} - {profile_row.whatsapp_number or ''}' if (profile_row.whatsapp_prefix or profile_row.whatsapp_number) else 'None'}",
                                f"{'Birthdate':<20} | {str(profile_row.birthdate or 'None')}",
                                f"{'Country':<20} | {str(profile_row.country or 'None')}",
                                f"{'Domicile':<20} | {str(profile_row.domicile or 'None')}",
                                f"{'Created At':<20} | {str(profile_row.created_at or 'None')}"
                            ]

                            # Combine all parts
                            table = "\n".join([header, separator] + rows)
                            return table

                        # Output formatted data
                        self.stdout.write(f"\n\n=== PROFILE DATA ===\n{format_profile_table(profile)}\n")

                        # Similarly for document if it exists
                        # For document table
                        if document:
                            doc_header = f"{'DOCUMENT FIELD':<20} | {'VALUE'}"
                            doc_separator = f"{'-' * 20} | {'-' * 40}"
                            doc_rows = [
                                f"{'Type':<20} | {str(document.type)}",
                                f"{'Number':<20} | {str(document.number)}",
                                f"{'Expiration':<20} | {str(document.expiration)}"
                            ]
                            doc_table = "\n".join([doc_header, doc_separator] + doc_rows)
                            self.stdout.write(f"\n=== DOCUMENT DATA ===\n{doc_table}\n")

                        # For ESNcard table
                        if esncard:
                            card_header = f"{'ESNCARD FIELD':<20} | {'VALUE'}"
                            card_separator = f"{'-' * 20} | {'-' * 40}"
                            card_rows = [
                                f"{'Number':<20} | {str(esncard.number)}",
                                f"{'Created At':<20} | {str(esncard.created_at)}",
                                f"{'Expiration':<20} | {str(getattr(esncard, 'expiration', 'Not set'))}"
                            ]
                            card_table = "\n".join([card_header, card_separator] + card_rows)
                            self.stdout.write(f"\n=== ESNCARD DATA ===\n{card_table}\n")

                        success_count += 1
                except Exception as e:
                    error_count += 1
                    errors.append(f"Error processing row for {row.get('email', 'unknown')}: {str(e)}")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run, rolling back transaction (no changes saved)"))

        return {
            'success_count': success_count,
            'error_count': error_count,
            'errors': errors
        }
