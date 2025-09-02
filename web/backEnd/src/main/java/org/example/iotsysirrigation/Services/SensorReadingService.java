package org.example.iotsysirrigation.Services;

import lombok.RequiredArgsConstructor;
import org.example.iotsysirrigation.Models.SensorReading;
import org.example.iotsysirrigation.Repositories.SensorReadingRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SensorReadingService {

    private final SensorReadingRepository repo;

    /** Fetch the latest N readings for a device, applying defaults for null fields. */
    public List<SensorReading> latest(String devEui, int limit) {
        List<SensorReading> raw = repo.findByDevEuiOrderByTimestampDesc(devEui, PageRequest.of(0, Math.max(1, limit)));
        return raw.stream().map(this::applyDefaults).collect(Collectors.toList());
    }

    /** Fetch readings in a time range, applying defaults for null fields. */
    public List<SensorReading> between(String devEui, Instant from, Instant to) {
        List<SensorReading> raw = repo.findByDevEuiAndTimestampBetweenOrderByTimestampDesc(devEui, from, to);
        return raw.stream().map(this::applyDefaults).collect(Collectors.toList());
    }

    /** Fetch the single most recent reading, applying defaults if needed. */
    public Optional<SensorReading> lastOne(String devEui) {
        List<SensorReading> list = latest(devEui, 1);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    /** Normalize nullable fields so upstream services/controllers can rely on them. */
    private SensorReading applyDefaults(SensorReading r) {
        if (r.getRxInfo() == null) {
            r.setRxInfo(List.of());
        }
        if (r.getSensorsReading() == null) {
            // keep it loose; you can change to Map.of() if you prefer a strongly-typed Map
            r.setSensorsReading(new HashMap<>());
        }
        // Ensure timestamp is set to "now" as a last resort (best is to store actual uplink time)
        try {
            var tsField = SensorReading.class.getDeclaredField("timestamp");
            tsField.setAccessible(true);
            Object v = tsField.get(r);
            if (v == null) tsField.set(r, Instant.now());
        } catch (Exception ignored) {}
        return r;
    }
}
