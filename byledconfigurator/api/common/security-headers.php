<?php
/**
 * Headers de sécurité communs à toutes les API
 * Compatible PrestaShop 1.6.1.11 (PHP 5.6+)
 * 
 * À inclure en début de chaque endpoint API :
 * require_once __DIR__ . '/common/security-headers.php';
 */

// ========================================
// HEADERS DE SÉCURITÉ HTTP
// ========================================

// Content-Type avec charset UTF-8
header('Content-Type: application/json; charset=utf-8');

// Empêche le navigateur de deviner le MIME type
// Protection contre attaques MIME type sniffing
header('X-Content-Type-Options: nosniff');

// Protection contre clickjacking
// SAMEORIGIN = autorise iframe uniquement depuis même domaine
header('X-Frame-Options: SAMEORIGIN');

// Active la protection XSS du navigateur (legacy mais utile)
header('X-XSS-Protection: 1; mode=block');

// ========================================
// CORS (Cross-Origin Resource Sharing)
// ========================================

// IMPORTANT : À configurer selon votre environnement
// 
// Option 1 - Développement local (ACTUEL - À CHANGER EN PROD)
header('Access-Control-Allow-Origin: *');

// Option 2 - Production avec domaine fixe (RECOMMANDÉ)
// header('Access-Control-Allow-Origin: https://votre-domaine.com');

// Option 3 - Production avec vérification dynamique
/*
$allowedOrigins = [
    'https://votre-domaine.com',
    'https://www.votre-domaine.com',
    'https://staging.votre-domaine.com'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
*/

// Méthodes HTTP autorisées
header('Access-Control-Allow-Methods: GET, OPTIONS');

// Headers autorisés dans les requêtes
header('Access-Control-Allow-Headers: Content-Type');

// Durée de cache des requêtes preflight (en secondes)
header('Access-Control-Max-Age: 3600');

// ========================================
// GESTION DES REQUÊTES OPTIONS (PREFLIGHT)
// ========================================

// Si c'est une requête preflight, répondre immédiatement
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204); // No Content
    exit;
}

// ========================================
// PROTECTION RATE LIMITING BASIQUE
// ========================================

/**
 * Protection basique contre abus
 * Limite : 100 requêtes par minute par IP
 * 
 * Note: Pour une protection robuste en production,
 * utiliser un système de cache (Redis/Memcached) ou
 * un reverse proxy (Cloudflare, nginx rate limiting)
 */
function checkRateLimit() {
    $rateLimitFile = __DIR__ . '/../cache/rate_limit.json';
    $maxRequests = 100;  // Requêtes max
    $timeWindow = 60;    // Fenêtre de temps (secondes)
    
    // Créer le dossier cache si nécessaire
    if (!is_dir(__DIR__ . '/../cache')) {
        @mkdir(__DIR__ . '/../cache', 0755, true);
    }
    
    // Récupérer IP du client
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    // Charger les données de rate limiting
    $data = [];
    if (file_exists($rateLimitFile)) {
        $content = file_get_contents($rateLimitFile);
        $data = json_decode($content, true) ?: [];
    }
    
    // Nettoyer les anciennes entrées
    $currentTime = time();
    foreach ($data as $ip => $records) {
        $data[$ip] = array_filter($records, function($timestamp) use ($currentTime, $timeWindow) {
            return ($currentTime - $timestamp) < $timeWindow;
        });
        
        if (empty($data[$ip])) {
            unset($data[$ip]);
        }
    }
    
    // Vérifier le nombre de requêtes pour cette IP
    if (!isset($data[$clientIp])) {
        $data[$clientIp] = [];
    }
    
    if (count($data[$clientIp]) >= $maxRequests) {
        // Rate limit dépassé
        http_response_code(429); // Too Many Requests
        header('Retry-After: 60');
        echo json_encode([
            'error' => 'Trop de requêtes',
            'code' => 'RATE_LIMIT_EXCEEDED',
            'details' => "Maximum $maxRequests requêtes par minute"
        ]);
        exit;
    }
    
    // Ajouter cette requête
    $data[$clientIp][] = $currentTime;
    
    // Sauvegarder
    file_put_contents($rateLimitFile, json_encode($data));
}

// Activer le rate limiting (décommenter pour activer)
// checkRateLimit();
