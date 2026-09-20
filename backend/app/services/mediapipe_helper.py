"""MediaPipe compatibility helper — returns (pose, is_available)"""

def load_pose():
    """Returns (pose_object, is_available)"""
    try:
        import mediapipe as mp
        pose = mp.solutions.pose.Pose(
            static_image_mode=True,
            min_detection_confidence=0.3
        )
        print("✅ MediaPipe Pose loaded")
        return pose, True
    except AttributeError:
        print("ℹ️  MediaPipe new API — using YOLO person count only")
        return None, False
    except Exception as e:
        print(f"⚠️  MediaPipe unavailable: {e}")
        return None, False