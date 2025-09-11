This repository contains a full-stack **smart irrigation** system. IoT end-nodes send measurements over **LoRaWAN** to a gateway, flow through **ChirpStack** and **MQTT**, are stored in **MongoDB**, exposed via a secure **Spring Boot** API, and visualized with an **Angular 20** dashboard.  
Everything runs with **Docker Compose** locally or on **AWS EC2 (Ubuntu)**.

```mermaid
flowchart LR
  subgraph Field
    A[End Node<br/>STM32WL55 + IKS01A3] -- LoRa --> B[LoRaWAN Gateway]
  end
  B -- UDP/1700 --> C[ChirpStack (EU868)]
  C -- MQTT pub/sub --> D[Mosquitto]
  D --> E[mqtt-to-mongo]
  E --> F[(MongoDB: iot_data.sensors)]
  F <--> G[Spring Boot API<br/>JWT / RBAC]
  G <--> H[Angular 20 Dashboard] 
```
