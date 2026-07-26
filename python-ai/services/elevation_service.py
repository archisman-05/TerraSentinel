import requests

def get_elevation(lat, lng):

    response = requests.get(
        f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lng}"
    )

    return response.json()["elevation"][0]