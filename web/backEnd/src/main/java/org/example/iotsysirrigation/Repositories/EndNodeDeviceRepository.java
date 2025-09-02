package org.example.iotsysirrigation.Repositories;


import org.example.iotsysirrigation.Models.EndNodeDevice;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface EndNodeDeviceRepository extends MongoRepository<EndNodeDevice, String> {
    Optional<EndNodeDevice> findByDevEui(String devEui);
    List<EndNodeDevice> findByUserId(String userId);
    List<EndNodeDevice> findByOrganizationId(String organizationId);
}
