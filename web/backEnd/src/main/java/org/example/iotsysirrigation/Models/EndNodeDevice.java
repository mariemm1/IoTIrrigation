package org.example.iotsysirrigation.Models;


import org.springframework.data.annotation.Id;
import lombok.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document("devices")
public class EndNodeDevice {
    @Id
    private String id;

    @Indexed(unique = true)
    private String devEui;

    private String name;
    private String address;
    private Instant lastSeen;
    private String description;

    private String organizationId; // to weach etablisment the user belong
    private String userId; // the device belong to whom

    /** GPS  it must be filled from latest readings */
    private Double lat;
    private Double lng;
    private Double altitude;

    private Instant createdAt;
    private Instant updatedAt;
}
