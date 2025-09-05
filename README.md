Introduction

This project is a full-stack smart-irrigation IoT platform. LoRaWAN end-nodes send sensor readings to a gateway → ChirpStack → MQTT → MongoDB. A Spring Boot API exposes the data to an Angular 19 dashboard (SSR). Everything runs with Docker Compose locally or on AWS EC2 (Ubuntu).

