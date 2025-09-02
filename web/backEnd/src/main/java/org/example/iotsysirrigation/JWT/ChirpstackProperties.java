package org.example.iotsysirrigation.JWT;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "chirpstack.api")
public class ChirpstackProperties {
    private String baseUrl;
    private String token;
}
