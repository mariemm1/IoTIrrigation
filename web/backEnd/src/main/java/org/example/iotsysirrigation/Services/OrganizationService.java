package org.example.iotsysirrigation.Services;

import lombok.RequiredArgsConstructor;
import org.example.iotsysirrigation.Models.Organization;
import org.example.iotsysirrigation.Repositories.OrganizationRepository;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository repo;

    public Organization create(Organization e) {
        if (repo.existsByName(e.getName())) {
            throw new IllegalArgumentException("Organization already exists");
        }
        return repo.save(e);
    }

    public List<Organization> getAll() {
        return repo.findAll();
    }

    public Optional<Organization> getById(String id) {
        return repo.findById(id);
    }

    public Organization update(String id, Organization updated) {
        return repo.findById(id)
                .map(existing -> {
                    existing.setName(updated.getName());
                    existing.setAddress(updated.getAddress());
                    existing.setContactEmail(updated.getContactEmail());
                    existing.setContactPhone(updated.getContactPhone());
                    existing.setDescription(updated.getDescription());
                    return repo.save(existing);
                })
                .orElseThrow(() -> new NoSuchElementException("Organization not found"));
    }

    public void delete(String id) {
        repo.deleteById(id);
    }
}
