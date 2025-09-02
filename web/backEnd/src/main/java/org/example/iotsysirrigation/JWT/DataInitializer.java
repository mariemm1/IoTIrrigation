package org.example.iotsysirrigation.JWT;

import org.example.iotsysirrigation.Models.Enum.Role;
import org.example.iotsysirrigation.Models.Organization;
import org.example.iotsysirrigation.Models.User;
import org.example.iotsysirrigation.Repositories.OrganizationRepository;
import org.example.iotsysirrigation.Repositories.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.*;

@Configuration
public class DataInitializer {

    // Admin bootstrap
    @Value("${app.admin.username}")
    private String adminUsername;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Value("${app.admin.email}")
    private String adminEmail;

    // Default organization bootstrap (name only is required)
    @Value("${app.bootstrap.org-name:CERT-MAIN}")
    private String defaultOrgName;

    @Value("${app.bootstrap.org-address:}")
    private String defaultOrgAddress;

    @Value("${app.bootstrap.org-email:#{null}}")
    private String defaultOrgEmail;

    @Value("${app.bootstrap.org-phone:}")
    private String defaultOrgPhone;

    @Bean
    public CommandLineRunner bootstrap(
            UserRepository userRepository,
            OrganizationRepository organizationRepository,
            PasswordEncoder encoder
    ) {
        return args -> {
            // 1) Ensure CERT-MAIN organization exists (idempotent)
            Organization org = organizationRepository.findByName(defaultOrgName)
                    .orElseGet(() -> {
                        Organization o = Organization.builder()
                                .name(defaultOrgName)
                                .address(defaultOrgAddress)
                                .contactEmail(defaultOrgEmail != null ? defaultOrgEmail : adminEmail)
                                .contactPhone(defaultOrgPhone)
                                .description("System bootstrap organization")
                                .build();
                        o = organizationRepository.save(o);
                        System.out.println("✅ Created default organization: " + o.getName());
                        return o;
                    });

            // 2) Ensure the admin user exists (idempotent)
            User admin = userRepository.findByUsername(adminUsername)
                    .or(() -> userRepository.findByEmail(adminEmail))
                    .orElseGet(() -> {
                        User u = User.builder()
                                .username(adminUsername)
                                .password(encoder.encode(adminPassword))
                                .email(adminEmail)
                                .organizationId(org.getId())
                                .roles(new HashSet<>(Set.of(Role.ADMIN)))
                                .build();
                        u = userRepository.save(u);
                        System.out.println("✅ Default admin user created and linked to " + defaultOrgName);
                        return u;
                    });

            // 3) Make sure existing admin is linked to CERT-MAIN and has ADMIN role
            boolean dirty = false;

            if (admin.getOrganizationId() == null || admin.getOrganizationId().isBlank()) {
                admin.setOrganizationId(org.getId());
                dirty = true;
            }
            Set<Role> roles = admin.getRoles() != null ? new HashSet<>(admin.getRoles()) : new HashSet<>();
            if (!roles.contains(Role.ADMIN)) {
                roles.add(Role.ADMIN);
                admin.setRoles(roles);
                dirty = true;
            }

            if (dirty) {
                userRepository.save(admin);
                System.out.println("✅ Ensured admin is linked to " + defaultOrgName + " with ADMIN role");
            }
        };
    }
}
