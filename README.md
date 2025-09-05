Introduction

This project is a full-stack smart-irrigation IoT platform. LoRaWAN end-nodes send sensor readings to a gateway → ChirpStack → MQTT → MongoDB. A Spring Boot API exposes the data to an Angular 19 dashboard (SSR). Everything runs with Docker Compose locally or on AWS EC2 (Ubuntu).

flowchart LR
  A[End Node (STM32WL55 + IKS01A3)] -- LoRa --> B[Gateway]
  B -- UDP/1700 --> C[ChirpStack (EU868)]
  C -- MQTT --> D[Mosquitto]
  D --> E[mqtt-to-mongo]
  E --> F[(MongoDB)]
  F <--> G[Spring Boot API (JWT/RBAC)]
  G <--> H[Angular 19 Dashboard (SSR)]
