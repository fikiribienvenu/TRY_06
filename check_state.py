from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'))
db = client['pulmoscan']

print("=== CT SCANS ===")
for s in db.ct_scans.find():
    print(f"  status={s['status']}  file={s.get('file_name','none')}  pred={s.get('prediction_id','none')}  report={s.get('report_id','none')}")

print("\n=== REPORTS ===")
for r in db.reports.find():
    print(f"  status={r['status']}  patient={r['patient_id']}  submitted={r.get('submitted_at','none')}")

print("\n=== PREDICTIONS ===")
for p in db.predictions.find():
    print(f"  {p['prediction']}  conf={p['confidence']}")

print("\n=== NOTIFICATIONS ===")
for n in db.notifications.find():
    print(f"  user={n.get('user_id')}  title={n.get('title')}  read={n.get('is_read')}")
