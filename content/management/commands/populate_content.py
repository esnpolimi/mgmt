from django.core.management.base import BaseCommand
from content.models import ContentSection, ContentLink


class Command(BaseCommand):
    help = 'Popola il database con i contenuti iniziali della home page'

    def handle(self, *args, **kwargs):
        self.stdout.write('Popolamento contenuti iniziali...')

        # Clear existing data
        ContentLink.objects.all().delete()
        ContentSection.objects.all().delete()

        # Section 1: LINK UTILI
        section1, _ = ContentSection.objects.get_or_create(
            title="LINK_UTILI",
            defaults={'order': 0, 'is_active': True}
        )

        links_utili = [
            {
                "name": "FOGLIO TURNI UFFICIO",
                "description": "Foglio per gestire i turni dell'ufficio ESN",
                "url": "https://docs.google.com/spreadsheets/d/1oHRaRcJvzt5XLfEjU-zlTcgH8ZOg9G-a9w0wGejAY2I/edit?gid=2036311463#gid=2036311463",
                "color": "#388e3c",
                "order": 0
            },
            {
                "name": "FOGLIO CONTASOLDI",
                "description": "Foglio per contare il denaro in cassa",
                "url": "https://docs.google.com/spreadsheets/d/1Ewt9DggEyDy8lT2Kh6YiN2k5SvGZnVkvPwpufZ0w5sU/edit",
                "color": "#f57c00",
                "order": 1
            },
            {
                "name": "FORM REPORT UFFICI",
                "description": "Form per i report degli uffici",
                "url": "https://goo.gl/forms/xAusvfJZdKppn2D13",
                "color": "#d32f2f",
                "order": 2
            },
            {
                "name": "FOGLI FIRME BANDI",
                "description": "Cartella con i fogli firme dei bandi",
                "url": "https://drive.google.com/drive/folders/1MBFMmga6IFPqPD_ER9HCdiHoI092y3Zs?usp=sharing",
                "color": "#7b1fa2",
                "order": 3
            },
            {
                "name": "SEGNALAZIONI BUGS/MIGLIORIE",
                "description": "Form per segnalare bug o proporre migliorie al gestionale",
                "url": "https://docs.google.com/forms/d/e/1FAIpQLSfgCax4iiVea-pHDppHGWHiOe2FmMknaT9Wsl2Kn5r2xBJTBw/viewform?usp=sharing&ouid=112656928168770237958",
                "color": "#29b6d2",
                "order": 4
            },
        ]

        for link_data in links_utili:
            ContentLink.objects.create(section=section1, **link_data)

        # Section 2: WIKI E TUTORIAL
        section2, _ = ContentSection.objects.get_or_create(
            title="WIKI_TUTORIAL",
            defaults={'order': 1, 'is_active': True}
        )

        wiki_links = [
            {
                "name": "WIKI ESN POLIMI",
                "description": "Wiki ufficiale di ESN Polimi con guide e informazioni",
                "url": "https://wiki.esnpolimi.it/",
                "color": "#512da8",
                "order": 0
            },
            {
                "name": "GUIDA GENERALE AL GESTIONALE",
                "description": "Guida completa all'utilizzo del gestionale",
                "url": "https://docs.google.com/document/d/1jgFvO2zo2xKmkPwbQGBQF7bgLrqkLSpB_BSG6guHdhs/edit?usp=sharing",
                "color": "#01476d",
                "order": 1
            },
            {
                "name": "TUTORIAL viaggi e attività",
                "description": "Tutorial per gestire viaggi e attività",
                "url": "https://drive.google.com/drive/folders/13DZUKo7D74VmbX2S3uKTOPrO5h1VFTGh",
                "color": "#0288d1",
                "order": 2
            },
            {
                "name": "Importazione Contatti DI MASSA",
                "description": "Guida per importare contatti in massa nel gestionale",
                "url": "https://docs.google.com/document/d/1OnwtNsKL9R5ph30IQcFMtPoMxq8-HyDs/edit?usp=sharing&ouid=112656928168770237958&rtpof=true&sd=true",
                "color": "#0097a7",
                "order": 3
            },
        ]

        for link_data in wiki_links:
            ContentLink.objects.create(section=section2, **link_data)

        self.stdout.write(self.style.SUCCESS('Contenuti popolati con successo!'))
        self.stdout.write(f'Sezioni create: {ContentSection.objects.count()}')
        self.stdout.write(f'Link creati: {ContentLink.objects.count()}')
