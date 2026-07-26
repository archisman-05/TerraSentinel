def create_bbox(lat, lng, delta=0.02):
    return [
        lng - delta,
        lat - delta,
        lng + delta,
        lat + delta,
    ]