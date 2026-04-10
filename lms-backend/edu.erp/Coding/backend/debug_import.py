import requests
url = 'http://127.0.0.1:8000/api/v1/topic_management/import_topic'
payload = {
    'academic_batch_id':1,
    'semester_id':1,
    'course_id':1,
    'section_id':1,
    'created_by':1
}
try:
    r = requests.post(url, json=payload, timeout=20)
    print('HTTP', r.status_code)
    print(r.text)
except Exception as e:
    print('Error:', type(e), e)
