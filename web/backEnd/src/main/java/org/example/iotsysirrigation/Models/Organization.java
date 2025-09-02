package org.example.iotsysirrigation.Models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document("organizations")
public class Organization {

    @Id
    private String id;

    private String name;
    private String address;
    private String contactEmail;
    private String contactPhone;
    private String description;


}
