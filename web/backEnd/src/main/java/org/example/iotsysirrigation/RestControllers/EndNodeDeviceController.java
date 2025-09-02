package org.example.iotsysirrigation.RestControllers;

import lombok.RequiredArgsConstructor;
import org.example.iotsysirrigation.Models.EndNodeDevice;
import org.example.iotsysirrigation.Services.EndNodeDeviceService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class EndNodeDeviceController {

    private final EndNodeDeviceService service;

    @PostMapping("/create")
    public ResponseEntity<?> createSmart(@RequestBody EndNodeDevice device) {
        try {
            EndNodeDevice created = service.createSmart(device);
            return new ResponseEntity<>(created, HttpStatus.CREATED);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Bad request";
            if (msg.toLowerCase().contains("already exists")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(msg);
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(msg);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to create device");
        }
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateSmart(@PathVariable String id, @RequestBody EndNodeDevice patch) {
        try {
            EndNodeDevice updated = service.updateSmart(id, patch);
            return ResponseEntity.ok(updated);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Bad request";
            if (msg.toLowerCase().contains("immutable")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(msg);
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(msg);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to update device");
        }
    }

    @GetMapping("/all")
    public ResponseEntity<List<EndNodeDevice>> getAll() {
        List<EndNodeDevice> list = service.findAll();
        return list.isEmpty() ? new ResponseEntity<>(HttpStatus.NO_CONTENT) : new ResponseEntity<>(list, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable String id) {
        return service.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body("Device not found"));
    }

    @GetMapping("/eui/{devEui}")
    public ResponseEntity<?> getByDevEui(@PathVariable String devEui) {
        return service.findByDevEui(devEui)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body("Device not found"));
    }

    @GetMapping("/CreatedBy/{userId}")
    public ResponseEntity<?> getByCreatedBy(@PathVariable String userId) {
        List<EndNodeDevice> list = service.findByOwner(userId);
        return list.isEmpty() ? new ResponseEntity<>(HttpStatus.NO_CONTENT) : new ResponseEntity<>(list, HttpStatus.OK);
    }

    @GetMapping("/organization/{orgId}")
    public ResponseEntity<?> getByOrganization(@PathVariable String orgId) {
        List<EndNodeDevice> list = service.findByOrganization(orgId);
        return list.isEmpty() ? new ResponseEntity<>(HttpStatus.NO_CONTENT) : new ResponseEntity<>(list, HttpStatus.OK);
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        try {
            service.delete(id);
            return ResponseEntity.ok("Device deleted successfully");
        } catch (Exception e) {
            return new ResponseEntity<>("Error deleting device", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
