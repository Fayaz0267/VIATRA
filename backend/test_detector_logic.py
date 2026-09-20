import unittest

import numpy as np

from app.services.detector import Detection, TrafficViolationDetector


class DetectorLogicTests(unittest.TestCase):
    def setUp(self):
        self.detector = object.__new__(TrafficViolationDetector)
        self.detector.plate_cache = {}
        self.detector.plate_client = None
        self.detector.ocr_available = False
        self.detector.ocr_reader = None
        self.detector.mp_available = False
        self.detector.pose = None

    def test_assign_persons_to_single_best_bike(self):
        bikes = [
            Detection((100, 100, 180, 200), "motorcycle", 0.9, 1, 11),
            Detection((190, 100, 270, 200), "motorcycle", 0.9, 1, 22),
        ]
        persons = [
            Detection((118, 72, 170, 198), "person", 0.8, 0, 101),
            Detection((198, 78, 252, 196), "person", 0.8, 0, 102),
        ]

        assignments = self.detector._assign_persons_to_bikes(persons, bikes)

        self.assertEqual([p.track_id for p in assignments[11]], [101])
        self.assertEqual([p.track_id for p in assignments[22]], [102])

    def test_count_riders_uses_assigned_riders(self):
        frame = np.zeros((320, 320, 3), dtype=np.uint8)
        bike_bbox = (100, 100, 180, 200)
        assigned = [
            Detection((110, 75, 145, 195), "person", 0.8, 0, 201),
            Detection((135, 70, 175, 198), "person", 0.8, 0, 202),
            Detection((150, 78, 192, 205), "person", 0.8, 0, 203),
        ]

        rider_count = self.detector._count_riders(
            frame, assigned, bike_bbox, assigned_riders=assigned
        )

        self.assertEqual(rider_count, 3)

    def test_plate_lookup_prefers_track_cache(self):
        vehicle = Detection((50, 50, 150, 150), "motorcycle", 0.8, 1, 77)
        frame = np.zeros((240, 240, 3), dtype=np.uint8)
        self.detector.plate_cache[77] = "TS09AB1234"

        plate = self.detector._read_plate_for_vehicle(frame, vehicle)

        self.assertEqual(plate, "TS09AB1234")


if __name__ == "__main__":
    unittest.main()
