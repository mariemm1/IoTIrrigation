package org.example.iotsysirrigation.Services;

import lombok.RequiredArgsConstructor;
import org.example.iotsysirrigation.Models.Enum.Role;
import org.example.iotsysirrigation.Models.User;
import org.example.iotsysirrigation.Repositories.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public User create(String username, String email, String rawPassword, Set<Role> roles, String organizationId) {
        if (userRepository.existsByEmail(email)) throw new IllegalArgumentException("Email already in use");
        if (userRepository.existsByUsername(username)) throw new IllegalArgumentException("Username already in use");

        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .roles(roles)
                .organizationId(organizationId)
                .build();
        return userRepository.save(user);
    }

    /** Update user information (optionally password). Performs uniqueness checks when changing username/email. */
    public User update(String userId, String username, String email, String rawPassword, Set<Role> roles, String organizationId) {
        User existing = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));

        if (username != null && !username.equals(existing.getUsername())) {
            if (userRepository.existsByUsername(username)) {
                throw new IllegalArgumentException("Username already in use");
            }
            existing.setUsername(username);
        }

        if (email != null && !email.equals(existing.getEmail())) {
            if (userRepository.existsByEmail(email)) {
                throw new IllegalArgumentException("Email already in use");
            }
            existing.setEmail(email);
        }

        if (rawPassword != null && !rawPassword.isBlank()) {
            existing.setPassword(passwordEncoder.encode(rawPassword));
        }

        if (roles != null && !roles.isEmpty()) {
            existing.setRoles(roles);
        }

        if (organizationId != null && !organizationId.isBlank()) {
            existing.setOrganizationId(organizationId);
        }

        return userRepository.save(existing);
    }

    public Optional<User> findByEmail(String email) { return userRepository.findByEmail(email); }
    public Optional<User> findById(String id) { return userRepository.findById(id); }
    public List<User> findAll() { return userRepository.findAll(); }
    public void deleteById(String id) { userRepository.deleteById(id); }
}
