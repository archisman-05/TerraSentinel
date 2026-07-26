from services.weather_service import get_weather
from services.elevation_service import get_elevation

def calculate_risk(weather):

    score = 0

    if weather["rain"] > 40:
        score += 35

    if weather["wind"] > 60:
        score += 25

    if weather["humidity"] > 90:
        score += 10

    if weather["elevation"] < 15:
        score += 20

    if weather["roadCount"] < 20:
        score += 10

    return min(score,100)
risk = calculate_risk(data)

data["riskScore"] = risk