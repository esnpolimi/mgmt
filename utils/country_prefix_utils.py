import json
import os
from django.conf import settings


def load_country_data():
    json_path = os.path.join(settings.BASE_DIR, 'utils', 'countryCodes.json')
    with open(json_path, 'r') as file:
        return json.load(file)


def map_country_to_code(name, country_codes):
    """Map country name to country code."""
    if not name or name == "NULL" or name == "--":
        return None

    # Try exact match first
    for country in country_codes:
        if country['name'].lower() == name.lower():
            return country['code']

    # Try partial match
    for country in country_codes:
        if name.lower() in country['name'].lower() or country['name'].lower() in name.lower():
            return country['code']

    return None


def get_prefix_by_country_code(name, country_codes):
    """Get dial code for a country name."""
    if not name or name == "NULL" or name == "--":
        return None

    for country in country_codes:
        if country['name'].lower() == name.lower():
            return country['dial']

    return None
