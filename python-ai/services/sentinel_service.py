import os
import requests
from dotenv import load_dotenv
from utils.geo import create_bbox

load_dotenv()

CLIENT_ID = os.getenv("SENTINEL_CLIENT_ID")
CLIENT_SECRET = os.getenv("SENTINEL_CLIENT_SECRET")

TOKEN_URL = "https://services.sentinel-hub.com/oauth/token"
PROCESS_URL = "https://services.sentinel-hub.com/api/v1/process"


def get_access_token():
    response = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )

    response.raise_for_status()

    return response.json()["access_token"]


def get_latest_image(lat, lng):

    token = get_access_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    bbox = create_bbox(lat, lng)

    payload = {
        "input": {
            "bounds": {
                "bbox": bbox
            },
            "data": [
                {
                    "type": "sentinel-1-grd",
                    "dataFilter": {
                        "timeRange": {
    "from": "2026-01-01T00:00:00Z",
    "to": "2026-12-31T23:59:59Z"
},
"timeliness": "NRT10m"
                    }
                }
            ]
        },
        "output": {
            "width": 512,
            "height": 512,
            "responses": [
                {
                    "identifier": "default",
                    "format": {
                        "type": "image/png"
                    }
                }
            ]
        },
        "evalscript": """
//VERSION=3

function setup() {
    return {
        input: ["VV", "VH"],
        output: {
            bands: 3
        }
    };
}

function evaluatePixel(sample) {

    let vv = sample.VV * 2.5;
    let vh = sample.VH * 3.0;

    return [
        vv,
        vh,
        vv
    ];
}
"""
    }

    response = requests.post(
        PROCESS_URL,
        headers=headers,
        json=payload,
    )

    response.raise_for_status()

    os.makedirs("temp", exist_ok=True)

    from datetime import datetime

    filename = datetime.now().strftime("%Y%m%d_%H%M%S") + ".png"

    image_path = f"temp/{filename}"

    with open(image_path, "wb") as f:
        f.write(response.content)

    return image_path