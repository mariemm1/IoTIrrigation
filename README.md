This repository contains a full-stack **smart irrigation** system. IoT end-nodes send measurements over **LoRaWAN** to a gateway, flow through **ChirpStack** and **MQTT**, are stored in **MongoDB**, exposed via a secure **Spring Boot** API, and visualized with an **Angular 20** dashboard.  
Everything runs with **Docker Compose** locally or on **AWS EC2 (Ubuntu)**.

flowchart LR
  %% Nodes (use \n for line breaks, not <br/>)
  A[End Node:\nSTM32WL55 + IKS01A3]
  B[LoRaWAN Gateway]
  C[ChirpStack (EU868)]
  D[Mosquitto]
  E[mqtt-to-mongo]
  F[(MongoDB\n iot_data.sensors)]
  G[Spring Boot API\n JWT / RBAC]
  H[Angular 20 Dashboard]

  %% Edges (use |label| syntax)
  A -->|LoRa| B
  B -->|UDP/1700| C
  C -->|"MQTT pub/sub"| D
  D --> E
  E --> F
  F <--> G
  G <--> H


