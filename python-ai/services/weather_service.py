import openmeteo_requests
import requests_cache
from retry_requests import retry

cache = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache, retries=5)

client = openmeteo_requests.Client(session=retry_session)

def get_weather(lat, lng):

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": lat,
        "longitude": lng,
        "current": [
            "temperature_2m",
            "rain",
            "wind_speed_10m",
            "relative_humidity_2m"
        ]
    }

    responses = client.weather_api(url, params=params)

    current = responses[0].Current()

    return {
        "temperature": current.Variables(0).Value(),
        "rain": current.Variables(1).Value(),
        "wind": current.Variables(2).Value(),
        "humidity": current.Variables(3).Value()
    }