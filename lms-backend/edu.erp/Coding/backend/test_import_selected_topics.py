"""
Test script for the modified import_topic endpoint
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_import_topic():
    url = f"{BASE_URL}/api/v1/topic_management/import_topic"

    # Test data - old format without instructor_id and topic_ids
    payload = {
        "academic_batch_id": 1,
        "semester_id": 1,
        "course_id": 1,
        "section_id": 2,
        "created_by": 1
    }

    print("Testing modified import_topic endpoint with old payload...")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")

    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Is the backend running?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_import_topic()