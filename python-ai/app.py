from fastapi import FastAPI

from services.sentinel_service import (
    get_access_token,
    get_latest_image,
)

from services.ai_service import analyze_image

app = FastAPI()


@app.get("/")
def root():
    return {
        "status": "running"
    }


@app.get("/test")
def test():

    token = get_access_token()

    return {
        "token": token[:30]
    }


from services.weather_service import get_weather
from services.elevation_service import get_elevation
from services.osm_service import get_roads

@app.post("/analyze")
def analyze(location: dict):

    lat = location["lat"]
    lng = location["lng"]

    weather = get_weather(lat, lng)

    elevation = get_elevation(lat, lng)

    roads = get_roads(lat, lng)

    return {
        "temperature": weather["temperature"],
        "rain": weather["rain"],
        "humidity": weather["humidity"],
        "wind": weather["wind"],
        "elevation": elevation,
        "roadCount": roads
    }