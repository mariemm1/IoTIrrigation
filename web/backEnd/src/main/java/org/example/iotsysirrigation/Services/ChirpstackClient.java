package org.example.iotsysirrigation.Services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChirpstackClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${chirpstack.api.base-url:http://localhost:8090}")
    private String baseUrl;

    @Value("${chirpstack.api.token}")
    private String token;

    public Optional<DeviceInfo> getDeviceByDevEui(String devEui) {
        try {
            String url = baseUrl + "/api/devices/" + devEui;
            HttpHeaders headers = authHeaders();
            ResponseEntity<String> resp =
                    restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            if (!resp.getStatusCode().is2xxSuccessful()) {
                log.warn("Device {} not found on ChirpStack: {}", devEui, resp.getStatusCode());
                return Optional.empty();
            }

            JsonNode body = objectMapper.readTree(resp.getBody());
            JsonNode device = body.path("device");

            return Optional.of(new DeviceInfo(
                    devEui,
                    device.path("name").asText(""),
                    device.path("description").asText(""),
                    body.path("lastSeenAt").asText(""),
                    body.path("createdAt").asText(""),
                    body.path("updatedAt").asText(""),
                    device.path("isDisabled").asBoolean(false) ? "OFFLINE" : "ONLINE"
            ));
        } catch (Exception e) {
            log.error("getDeviceByDevEui failed for {}", devEui, e);
            return Optional.empty();
        }
    }

    /** Update name/description/status on ChirpStack (v4). */
    public boolean updateDeviceMeta(String devEui, String name, String description, String status) {
        try {
            // GET current device to retain required ids/fields
            String getUrl = baseUrl + "/api/devices/" + devEui;
            HttpHeaders headers = authHeaders();
            ResponseEntity<String> getResp =
                    restTemplate.exchange(getUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            if (!getResp.getStatusCode().is2xxSuccessful()) {
                log.warn("ChirpStack GET before PUT failed for {}: {}", devEui, getResp.getStatusCode());
                return false;
            }

            JsonNode body = objectMapper.readTree(getResp.getBody());
            JsonNode d = body.path("device");

            // REQUIRED by ChirpStack v4
            String applicationId   = d.path("applicationId").asText(null);
            String deviceProfileId = d.path("deviceProfileId").asText(null);
            if (applicationId == null || applicationId.isBlank()) {
                log.warn("device {} missing applicationId", devEui);
                return false;
            }
            if (deviceProfileId == null || deviceProfileId.isBlank()) {
                log.warn("device {} missing deviceProfileId", devEui);
                return false; // <- was the cause of your 400 (expected length 32)
            }

            String currentName        = d.path("name").asText("");
            String currentDescription = d.path("description").asText("");
            boolean currentIsDisabled = d.path("isDisabled").asBoolean(false);
            String joinEui            = d.path("joinEui").asText(""); // keep if present

            String newName = (name != null ? name : currentName);
            String newDesc = (description != null ? description : currentDescription);

            Boolean newIsDisabled = null;
            if (status != null && !status.isBlank()) {
                String s = status.trim().toUpperCase();
                if ("OFFLINE".equals(s)) newIsDisabled = true;
                else if ("ONLINE".equals(s)) newIsDisabled = false;
            }
            boolean finalIsDisabled = (newIsDisabled != null ? newIsDisabled : currentIsDisabled);

            Map<String, String> tags = new HashMap<>();
            if (d.path("tags").isObject()) {
                d.path("tags").fields().forEachRemaining(e -> tags.put(e.getKey(), e.getValue().asText("")));
            }
            Map<String, String> variables = new HashMap<>();
            if (d.path("variables").isObject()) {
                d.path("variables").fields().forEachRemaining(e -> variables.put(e.getKey(), e.getValue().asText("")));
            }

            Map<String, Object> device = new HashMap<>();
            device.put("applicationId",   applicationId);
            device.put("deviceProfileId", deviceProfileId); // <-- REQUIRED
            device.put("devEui",          devEui);
            device.put("name",            newName);
            device.put("description",     newDesc);
            device.put("isDisabled",      finalIsDisabled);
            if (!joinEui.isBlank()) device.put("joinEui", joinEui);
            device.put("tags",            tags);
            device.put("variables",       variables);

            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("device", device);

            String putUrl = baseUrl + "/api/devices/" + devEui;
            HttpEntity<Map<String, Object>> putEntity = new HttpEntity<>(wrapper, headers);
            ResponseEntity<String> putResp =
                    restTemplate.exchange(putUrl, HttpMethod.PUT, putEntity, String.class);

            if (!putResp.getStatusCode().is2xxSuccessful()) {
                log.warn("ChirpStack PUT update failed for {}: {}", devEui, putResp.getStatusCode());
                return false;
            }
            return true;

        } catch (Exception e) {
            log.error("updateDeviceMeta failed for {}", devEui, e);
            return false;
        }
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    public record DeviceInfo(
            String devEui,
            String name,
            String description,
            String lastSeenAt,
            String createdAt,
            String updatedAt,
            String status
    ) {}
}
