# -*- coding: utf-8 -*-

from dotenv import load_dotenv
import json
import paho.mqtt.client as mqtt
from pymongo import MongoClient
from datetime import datetime
from urllib.parse import quote_plus
import os
load_dotenv()


username = os.getenv("MONGO_USERNAME")
password = os.getenv("MONGO_PASSWORD")
host = os.getenv("MONGO_HOST")
port = os.getenv("MONGO_PORT")

# Print out values to check if they are loaded
print(f"Username: {username}")
print(f"Password: {password}")
print(f"Host: {host}")
print(f"Port: {port}")

# URL-encoding the username and password
if username and password:  # Ensure they are not None
    encoded_username = quote_plus(username.encode('utf-8'))
    encoded_password = quote_plus(password.encode('utf-8'))

    # Construct the MongoDB URI
    MONGO_URI = f"mongodb://{encoded_username}:{encoded_password}@{host}:{port}/?authSource=admin"
    print(f"MONGO_URI: {MONGO_URI}")
else:
    print("Username or password is missing!")

MONGO_DB =  os.getenv("MONGO_DB")

MONGO_COLLECTION =  os.getenv("MONGO_COLLECTION")


mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
collection = db[MONGO_COLLECTION]

# --- MQTT Setup ---
MQTT_BROKER = "mosquitto"  # Docker service name or "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "application/+/device/+/event/up"

def on_connect(client, userdata, flags, rc, properties):
    print(f"[MQTT] Connected with result code {rc}")
    client.subscribe(MQTT_TOPIC)
    print(f"[MQTT] Subscribed to topic: {MQTT_TOPIC}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        print(f"[MQTT] Received message on {msg.topic}")

        # Sample structured data
        data = {
            
            "application_id":  payload.get("deviceInfo", {}).get("applicationId"),
            "dev_eui" : payload.get("deviceInfo", {}).get('devEui'),
            "f_port": payload.get("fPort"),
            "data": payload.get("data"),
            "rx_info": payload.get("rxInfo"),
            "object_json": payload.get("object"),
            "timestamp": datetime.utcnow()
        }

        collection.insert_one(data)
        print("[MongoDB] Inserted uplink data.")
    except Exception as e:
        print(f"[Error] {e}")

# MQTT Client Setup
mqtt_client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
print("[System] Starting MQTT loop...")
mqtt_client.loop_forever()
