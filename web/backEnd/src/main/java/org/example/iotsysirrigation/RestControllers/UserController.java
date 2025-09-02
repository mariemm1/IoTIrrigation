package org.example.iotsysirrigation.RestControllers;

import lombok.RequiredArgsConstructor;
import org.example.iotsysirrigation.Models.Enum.Role;
import org.example.iotsysirrigation.Models.User;
import org.example.iotsysirrigation.Services.UserService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {

    private final UserService userService;

    @GetMapping("/allUsers")
    public ResponseEntity<List<User>> getAllUsers() {
        try {
            List<User> users = userService.findAll();
            if (users.isEmpty()) return new ResponseEntity<>(HttpStatus.NO_CONTENT);
            return new ResponseEntity<>(users, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/user/{id}")
    public ResponseEntity<User> getUserById(@PathVariable String id) {
        try {
            return userService.findById(id)
                    .map(user -> new ResponseEntity<>(user, HttpStatus.OK))
                    .orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/createUser")
    public ResponseEntity<User> create(@RequestBody Map<String,Object> payload) {
        String uname = (String) payload.get("username");
        String email = (String) payload.get("email");
        String pwd   = (String) payload.get("password");
        @SuppressWarnings("unchecked")
        List<String> roles = (List<String>) payload.getOrDefault("roles", List.of("CLIENT"));
        Set<Role> rset = new HashSet<>();
        roles.forEach(r -> rset.add(Role.valueOf(r)));
        User u = userService.create(uname, email, pwd, rset, (String) payload.get("organizationId"));
        return ResponseEntity.status(HttpStatus.CREATED).body(u);
    }

    /** Update user info; body fields are optional. If password is provided, it will be re-encoded. */
    @PutMapping("/updateUser/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        try {
            String uname = (String) payload.get("username");
            String email = (String) payload.get("email");
            String pwd   = (String) payload.get("password");
            String orgId = (String) payload.get("organizationId");

            @SuppressWarnings("unchecked")
            List<String> rolesList = (List<String>) payload.get("roles");
            Set<Role> roles = null;
            if (rolesList != null) {
                roles = new HashSet<>();
                for (String r : rolesList) roles.add(Role.valueOf(r));
            }

            User updated = userService.update(id, uname, email, pwd, roles, orgId);
            return ResponseEntity.ok(updated);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Update failed"));
        }
    }

    @DeleteMapping("/deleteUser/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        userService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
