package org.example.iotsysirrigation;

import org.example.iotsysirrigation.JWT.ChirpstackProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({ChirpstackProperties.class})
public class IotSysIrrigationApplication {

    public static void main(String[] args) {
        SpringApplication.run(IotSysIrrigationApplication.class, args);
    }

}
