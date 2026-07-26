import requests

def get_roads(lat, lng):

    query = f"""
[out:json];
way
(around:3000,{lat},{lng})
["highway"];
out ids;
"""

    try:
        r = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=query,
            timeout=15
        )

        print("Status:", r.status_code)
        print("Response:", r.text[:200])

        if r.status_code != 200:
            return 0

        try:
            data = r.json()
            return len(data.get("elements", []))
        except:
            return 0

    except Exception as e:
        print(e)
        return 0