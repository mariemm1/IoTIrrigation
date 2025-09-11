This repository contains a full-stack **smart irrigation** system. IoT end-nodes send measurements over **LoRaWAN** to a gateway, flow through **ChirpStack** and **MQTT**, are stored in **MongoDB**, exposed via a secure **Spring Boot** API, and visualized with an **Angular 20** dashboard.  
Everything runs with **Docker Compose** locally or on **AWS EC2 (Ubuntu)**.

flowchart LR
  %% ============== NODES ==============
  subgraph Field
    A[End Node\nSTM32WL55 + IKS01A3]
    B[LoRaWAN Gateway]
  end

  subgraph Platform
    C[ChirpStack\n(EU868)]
    D[Mosquitto\n(MQTT Broker)]
    E[mqtt-to-mongo\n(Bridge)]
    F[(MongoDB\n iot_data.sensors)]
    G[Spring Boot API\n JWT / RBAC]
    H[Angular 20 Dashboard\n (SSR)]
  end

  %% ============== EDGES (with labels) ==============
  A -->|LoRa| B
  B -->|UDP/1700| C
  C -->|"MQTT pub/sub"| D
  D --> E
  E --> F
  F <--> G
  G <--> H

  %% ============== STYLES ==============
  classDef device  fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#1b5e20;
  classDef gateway fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#0d47a1;
  classDef server  fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#4e342e;
  classDef db      fill:#ede7f6,stroke:#6a1b9a,stroke-width:2px,color:#4a148c;
  classDef web     fill:#e8eaf6,stroke:#283593,stroke-width:2px,color:#1a237e;

  class A device;
  class B gateway;
  class C,D,E,G server;
  class F db;
  class H web;



