package org.example.iotsysirrigation.RestControllers;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.iotsysirrigation.Services.EndNodeDeviceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/commands")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200") // optional; proxy usually handles this
public class CommandController {

    private final EndNodeDeviceService deviceService;

    public record CommandRequest(Integer value, String action, Integer fPort) {}

    @PostMapping("/{devEui}")
    public ResponseEntity<?> send(@PathVariable String devEui, @RequestBody CommandRequest req) {
        try {
            // Accept either explicit value or action OPEN/CLOSE
            int v;
            if (req != null && req.value != null) {
                v = req.value > 0 ? 1 : 0;
            } else if (req != null && req.action != null) {
                String a = req.action.trim().toUpperCase();
                v = ("OPEN".equals(a) || "ON".equals(a)) ? 1 : 0;
            } else {
                return ResponseEntity.badRequest().body("Missing value/action");
            }

            Integer fPort = (req != null && req.fPort != null) ? req.fPort : 2; // default fPort=2
            boolean ok = deviceService.sendCommand(devEui, v, fPort);
            if (!ok) return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Failed to enqueue downlink");

            return ResponseEntity.ok(Map.of("ok", true, "devEui", devEui, "value", v, "fPort", fPort));
        } catch (Exception e) {
            log.error("Command enqueue failed for {}", devEui, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Command enqueue error");
        }
    }
}
