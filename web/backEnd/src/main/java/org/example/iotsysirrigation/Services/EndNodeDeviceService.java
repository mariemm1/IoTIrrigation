// src/main/java/.../Services/EndNodeDeviceService.java
package org.example.iotsysirrigation.Services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.iotsysirrigation.Models.EndNodeDevice;
import org.example.iotsysirrigation.Models.Organization;
import org.example.iotsysirrigation.Models.SensorReading;
import org.example.iotsysirrigation.Repositories.EndNodeDeviceRepository;
import org.example.iotsysirrigation.Repositories.OrganizationRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class EndNodeDeviceService {

    private final EndNodeDeviceRepository repo;
    private final OrganizationRepository orgRepo;
    private final ChirpstackClient chirpstackClient;
    private final SensorReadingService readingService;

    /** Lowercase hex, no separators — keeps DB/ChirpStack lookups consistent. */
    private String norm(String eui) {
        return eui == null ? null : eui.replaceAll("[^0-9a-fA-F]", "").toLowerCase();
    }

    /** Create device: validate org & user, sync meta from ChirpStack, set org address, backfill GPS from latest reading. */
    public EndNodeDevice createSmart(EndNodeDevice device) {
        device.setDevEui(norm(device.getDevEui()));             // <-- normalize once

        repo.findByDevEui(device.getDevEui()).ifPresent(d -> {
            throw new IllegalArgumentException("Device with devEui '" + device.getDevEui() + "' already exists.");
        });

        String orgId = device.getOrganizationId();
        if (orgId == null || orgId.isBlank() || !orgRepo.existsById(orgId)) {
            throw new IllegalArgumentException("No Organization found with id: " + orgId);
        }
        Organization org = orgRepo.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found after existence check"));

        String userId = device.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("Missing or empty userId in the request.");
        }

        // Must exist on ChirpStack
        var infoOpt = chirpstackClient.getDeviceByDevEui(device.getDevEui());  // uses normalized EUI
        if (infoOpt.isEmpty()) {
            throw new NoSuchElementException("No device found in ChirpStack with devEui " + device.getDevEui());
        }
        var info = infoOpt.get();

        Instant now = Instant.now();
        device.setCreatedAt(now);
        device.setUpdatedAt(now);
        device.setName(info.name());
        device.setDescription(info.description());
        try { device.setLastSeen(Instant.parse(info.lastSeenAt())); } catch (Exception ignored) {}
        try { device.setCreatedAt(Instant.parse(info.createdAt())); } catch (Exception ignored) {}
        try { device.setUpdatedAt(Instant.parse(info.updatedAt())); } catch (Exception ignored) {}

        device.setAddress(org.getAddress());

        readingService.lastOne(device.getDevEui()).ifPresent(r -> {
            extractGps(r).ifPresent(g -> {
                device.setLat(g[0]);
                device.setLng(g[1]);
                if (g.length > 2) device.setAltitude(g[2]);
            });
        });

        return repo.save(device);
    }

    public List<EndNodeDevice> findAll() { return repo.findAll(); }
    public Optional<EndNodeDevice> findById(String id) { return repo.findById(id); }

    /** Lightweight “peek” from ChirpStack for display; doesn’t persist. */
    public Optional<EndNodeDevice> findByDevEui(String devEui) {
        String eui = norm(devEui);                               // <-- normalize
        try {
            return chirpstackClient.getDeviceByDevEui(eui).map(info -> {
                EndNodeDevice d = new EndNodeDevice();
                d.setDevEui(eui);
                d.setName(info.name());
                d.setDescription(info.description());
                try { d.setLastSeen(Instant.parse(info.lastSeenAt())); } catch (Exception ignored) {}
                try { d.setCreatedAt(Instant.parse(info.createdAt())); } catch (Exception ignored) {}
                try { d.setUpdatedAt(Instant.parse(info.updatedAt())); } catch (Exception ignored) {}
                return d;
            });
        } catch (Exception e) {
            log.error("Error fetching device from ChirpStack {}", eui, e);
            return Optional.empty();
        }
    }

    public List<EndNodeDevice> findByOwner(String userId) { return repo.findByUserId(userId); }
    public List<EndNodeDevice> findByOrganization(String organizationId) { return repo.findByOrganizationId(organizationId); }

    /**
     * devEui/orgId/userId immutable.
     * Push name/description to ChirpStack first; save to DB only if that succeeds.
     */
    public EndNodeDevice updateSmart(String id, EndNodeDevice patch) {
        EndNodeDevice existing = repo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Device not found: " + id));

        // defensive normalize on compare
        if (patch.getDevEui() != null && !norm(patch.getDevEui()).equals(norm(existing.getDevEui()))) {
            throw new IllegalArgumentException("devEui is immutable.");
        }
        if (patch.getOrganizationId() != null && !patch.getOrganizationId().equals(existing.getOrganizationId())) {
            throw new IllegalArgumentException("organizationId is immutable.");
        }
        if (patch.getUserId() != null && !patch.getUserId().equals(existing.getUserId())) {
            throw new IllegalArgumentException("userId is immutable.");
        }

        String newName        = patch.getName()        != null ? patch.getName()        : existing.getName();
        String newDescription = patch.getDescription() != null ? patch.getDescription() : existing.getDescription();
        String newAddress     = patch.getAddress()     != null ? patch.getAddress()     : existing.getAddress();

        boolean ok = chirpstackClient.updateDeviceMeta(norm(existing.getDevEui()), newName, newDescription, null);
        if (!ok) {
            throw new IllegalStateException("Failed to update device metadata on ChirpStack.");
        }

        if (patch.getLat() == null && patch.getLng() == null) {
            readingService.lastOne(existing.getDevEui()).ifPresent(r -> {
                extractGps(r).ifPresent(g -> {
                    existing.setLat(g[0]);
                    existing.setLng(g[1]);
                    if (g.length > 2) existing.setAltitude(g[2]);
                });
            });
        } else {
            if (patch.getLat() != null) existing.setLat(patch.getLat());
            if (patch.getLng() != null) existing.setLng(patch.getLng());
            if (patch.getAltitude() != null) existing.setAltitude(patch.getAltitude());
        }

        existing.setName(newName);
        existing.setDescription(newDescription);
        existing.setAddress(newAddress);
        existing.setUpdatedAt(Instant.now());
        existing.setDevEui(norm(existing.getDevEui()));          // keep stored normalized

        return repo.save(existing);
    }

    public void delete(String id) { repo.deleteById(id); }

    /** Try to read GPS from object_json (preferred), then rx_info[*].location. */
    private Optional<double[]> extractGps(SensorReading r) {
        // 1) object_json (decoded payload)
        Object obj = r.getSensorsReading();
        if (obj instanceof Map<?,?> map) {
            Double lat = findDouble(map, "lat","latitude","gps_lat","gpsLatitude");
            Double lng = findDouble(map, "lng","lon","longitude","gps_lon","gpsLongitude");
            Double alt = findDouble(map, "alt","altitude","gps_alt","gpsAltitude");
            if (lat == null || lng == null) {
                // nested objects like gps / location
                Map<String, Object> nested = findNestedMap(map, "gps","location","coordinates");
                if (nested != null) {
                    if (lat == null) lat = findDouble(nested, "lat","latitude");
                    if (lng == null) lng = findDouble(nested, "lng","lon","longitude");
                    if (alt == null) alt = findDouble(nested, "alt","altitude");
                }
            }
            if (lat != null && lng != null) {
                return Optional.of(alt != null ? new double[]{lat, lng, alt} : new double[]{lat, lng});
            }
        }
        // 2) rx_info[*].location  (ChirpStack gateways sometimes include this)
        if (r.getRxInfo() != null) {
            for (Map<String, Object> rx : r.getRxInfo()) {
                Object locObj = rx.get("location");
                if (locObj instanceof Map<?,?> loc) {
                    Double lat = asDouble(loc.get("latitude"));
                    Double lng = asDouble(loc.get("longitude"));
                    Double alt = asDouble(loc.get("altitude"));
                    if (lat != null && lng != null) {
                        return Optional.of(alt != null ? new double[]{lat, lng, alt} : new double[]{lat, lng});
                    }
                }
            }
        }
        return Optional.empty();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> findNestedMap(Map<?,?> map, String... keys) {
        for (String k : keys) {
            Object v = map.get(k);
            if (v instanceof Map<?,?>) return (Map<String, Object>) v;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Double findDouble(Map<?,?> map, String... keys) {
        for (String k : keys) {
            Object v = map.get(k);
            Double dv = asDouble(v);
            if (dv != null) return dv;
        }
        return null;
    }

    private Double asDouble(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof String s) {
            try { return Double.parseDouble(s); } catch (Exception ignored) {}
        }
        return null;
    }


    /** Enqueue a one-byte downlink (1=open, 0=close) via ChirpStack. */
    public boolean sendCommand(String devEui, Integer value, Integer fPort) {
        String eui = norm(devEui);
        int v = (value != null && value > 0) ? 1 : 0;
        return chirpstackClient.enqueueDownlink(eui, v, fPort);
    }

}
