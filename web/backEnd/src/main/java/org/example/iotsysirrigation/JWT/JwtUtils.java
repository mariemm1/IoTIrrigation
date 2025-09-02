package org.example.iotsysirrigation.JWT;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtils {

    // Token validity: 24 hours
    private static final long EXPIRATION_TIME = 1000 * 60 * 60 * 24;

    // Secret key (in production, use a static, securely stored key!)
    private final Key key = Keys.secretKeyFor(SignatureAlgorithm.HS256);


    public String generateToken(String username, String role, String userId, String organizationId) {
        return Jwts.builder()
                .setSubject(username) // email as "sub"
                .claim("role", role)
                .claim("id", userId)
                .claim("organizationId",organizationId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(key)
                .compact();
    }

    //Validates the token's signature and expiration
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (JwtException e) {
            // Log invalid token attempts if needed
            return false;
        }
    }

    // Extracts the subject (username) from the token
    public String extractUsername(String token) {return getClaims(token).getSubject();}


    //Extracts the role from the token
    public String extractRole(String token) {
        return getClaims(token).get("role", String.class);
    }


    //Extracts the user ID from the token
    public Long extractUserId(String token) {
        return getClaims(token).get("id", Long.class);
    }


    //Utility to extract claims
    private Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
