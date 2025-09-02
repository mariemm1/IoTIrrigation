package org.example.iotsysirrigation.RestControllers;

import lombok.RequiredArgsConstructor;
import org.example.iotsysirrigation.Models.Organization;
import org.example.iotsysirrigation.Services.OrganizationService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class OrganizationController {

    private final OrganizationService service;

    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody Organization e) {
        try {
            Organization created = service.create(e);
            return new ResponseEntity<>(created, HttpStatus.CREATED);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/all")
    public ResponseEntity<List<Organization>> getAll() {
        List<Organization> list = service.getAll();
        return list.isEmpty() ? ResponseEntity.noContent().build() : ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Organization> getById(@PathVariable String id) {
        return service.getById(id)
                .map(result -> new ResponseEntity<>(result, HttpStatus.OK))
                .orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Organization updated) {
        try {
            Organization saved = service.update(id, updated);
            return new ResponseEntity<>(saved, HttpStatus.OK);
        } catch (NoSuchElementException e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", "Update failed"), HttpStatus.BAD_REQUEST);
        }
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable String id) {
        try {
            service.delete(id);
            return ResponseEntity.ok(Map.of("message", "Organization deleted successfully", "id", id));
        } catch (Exception e) {
            return new ResponseEntity<>(Map.of("error", "Failed to delete Organization", "details", e.getMessage()),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
