package org.example.iotsysirrigation.Models;


import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "sensors")
public class SensorReading {

    @Id
    private String id;

    @Field("application_id")
    private String applicationId;

    @Field("dev_eui")
    private String devEui;

    @Field("f_port")
    private int fPort;

    /** Raw base64 payload (as sent by device) */
    private String data;

    /** We keep rx_info loose since content differs per gateway */
    @Field("rx_info")
    private List<Map<String, Object>> rxInfo;

    /** Strongly-typed view of the decoded payload */
    @Field("object_json")
    private Object sensorsReading;

    @Field("timestamp")
    private Instant timestamp;


}


