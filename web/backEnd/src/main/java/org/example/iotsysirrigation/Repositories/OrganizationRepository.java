package org.example.iotsysirrigation.Repositories;

import org.example.iotsysirrigation.Models.Organization;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface OrganizationRepository extends MongoRepository<Organization, String> {
    boolean existsByName(String name);
    Optional<Organization> findByName(String name);


}

