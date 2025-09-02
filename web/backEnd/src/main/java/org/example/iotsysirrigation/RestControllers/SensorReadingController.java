package org.example.iotsysirrigation.RestControllers;

import lombok.RequiredArgsConstructor;
import org.example.iotsysirrigation.Models.SensorReading;
import org.example.iotsysirrigation.Services.SensorReadingService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/readings")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class SensorReadingController {

    private final SensorReadingService readingService;

    @GetMapping("/latest/{devEui}")
    public ResponseEntity<?> getLatest(@PathVariable String devEui,
                                       @RequestParam(defaultValue = "10") int limit) {
        try {
            List<SensorReading> readings = readingService.latest(devEui, limit);
            if (readings.isEmpty()) {
                return ResponseEntity.noContent().build();
            }
            return new ResponseEntity<>(readings, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error retrieving latest readings: " + e.getMessage());
        }
    }

    @GetMapping("/range/{devEui}")
    public ResponseEntity<?> getInRange(@PathVariable String devEui,
                                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
                                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        try {
            List<SensorReading> readings = readingService.between(devEui, from, to);
            if (readings.isEmpty()) {
                return ResponseEntity.noContent().build();
            }
            return new ResponseEntity<>(readings, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Invalid date range or error: " + e.getMessage());
        }
    }

    @GetMapping("/last2h/{devEui}")
    public ResponseEntity<?> getLast2Hours(@PathVariable String devEui) {
        try {
            Instant now = Instant.now();
            Instant from = now.minus(2, ChronoUnit.HOURS);
            List<SensorReading> readings = readingService.between(devEui, from, now);
            if (readings.isEmpty()) {
                return ResponseEntity.noContent().build();
            }
            return new ResponseEntity<>(readings, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching last 2h data: " + e.getMessage());
        }
    }

    @GetMapping("/last24h/{devEui}")
    public ResponseEntity<?> getLast24Hours(@PathVariable String devEui) {
        try {
            Instant now = Instant.now();
            Instant from = now.minus(24, ChronoUnit.HOURS);
            List<SensorReading> readings = readingService.between(devEui, from, now);
            if (readings.isEmpty()) {
                return ResponseEntity.noContent().build();
            }
            return new ResponseEntity<>(readings, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching last 24h data: " + e.getMessage());
        }
    }

    @GetMapping("/lastMonth/{devEui}")
    public ResponseEntity<?> getLastMonth(@PathVariable String devEui) {
        try {
            Instant now = Instant.now();
            Instant from = now.minus(30, ChronoUnit.DAYS);
            List<SensorReading> readings = readingService.between(devEui, from, now);
            if (readings.isEmpty()) {
                return ResponseEntity.noContent().build();
            }
            return new ResponseEntity<>(readings, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error retrieving last month's data: " + e.getMessage());
        }
    }

    @GetMapping("/lastYear/{devEui}")
    public ResponseEntity<?> getLastYear(@PathVariable String devEui) {
        try {
            Instant now = Instant.now();
            Instant from = now.minus(365, ChronoUnit.DAYS);
            List<SensorReading> readings = readingService.between(devEui, from, now);
            if (readings.isEmpty()) {
                return ResponseEntity.noContent().build();
            }
            return new ResponseEntity<>(readings, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error retrieving last year's data: " + e.getMessage());
        }
    }
}
