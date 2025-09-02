package org.example.iotsysirrigation.Repositories;

import org.example.iotsysirrigation.Models.SensorReading;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Pageable;
import java.time.Instant;
import java.util.List;

@Repository
public interface SensorReadingRepository  extends MongoRepository<SensorReading,String> {
//    List<SensorReading> findByDevEuiOrderByTimestampDesc(String devEui);
    List<SensorReading> findByDevEuiOrderByTimestampDesc(String devEui, Pageable pageable);
    List<SensorReading> findByDevEuiAndTimestampBetweenOrderByTimestampDesc(String devEui, Instant from, Instant to);
}

