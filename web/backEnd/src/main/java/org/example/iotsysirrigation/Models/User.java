package org.example.iotsysirrigation.Models;

import org.springframework.data.annotation.Id;
import lombok.*;
import org.example.iotsysirrigation.Models.Enum.Role;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Set;

@Document("users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String id;

    private String username;
    private String password;     // store BCrypt'ed
    private String email;
    private String organizationId;
    private Set<Role> roles;
}