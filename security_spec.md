# Spécification de Sécurité Firestore — TECH STYLE MARKET

## 1. Invariants de Données (Data Invariants)

1. **Isolation PII (`users`)** : Un document `/users/{userId}` contient des données personnelles (`email`, `phone`, `city`). Seul le propriétaire (`request.auth.uid == userId`) ou un administrateur vérifié (`isAdmin()`) peut le lire. Aucun utilisateur ne peut s'attribuer le rôle `admin` dans `users/{userId}` ni modifier `suspended`.
2. **Intégrité des Boutiques (`stores`)** : Un vendeur ne peut créer ou modifier que sa propre boutique (`ownerId == request.auth.uid`). Le champ `verificationStatus` est réservé à l'administration lors des mises à jour.
3. **Intégrité des Produits (`products`)** : Un produit ne peut être créé, modifié ou supprimé que par le propriétaire de la boutique référencée (`sellerId == request.auth.uid` et `store.ownerId == request.auth.uid`), sauf lors d'une décrémentation atomique de stock liée à une commande valide.
4. **Intégrité des Commandes (`orders` & `orderLocks`)** : Une commande ne peut être lue que par son client (`customerId`), son vendeur (`sellerId`) ou un administrateur. Lors de la création, le prix unitaire et le stock de chaque article sont vérifiés contre la base de données, et `orderLocks/{idempotencyKey}` garantit l'absence de doublon.
5. **Favoris (`favorites`)** : Seul le propriétaire (`userId == request.auth.uid`) peut lire, ajouter ou retirer ses favoris.
6. **Conversations et Messages (`conversations`, `messages`)** : Seuls les participants listés (`request.auth.uid in participants`) peuvent lire ou écrire dans une conversation et ses messages.
7. **Rôle Administrateur (`admins/{uid}` + email vérifié bootstrap)** : Aucun client ne peut créer ou modifier `/admins/{uid}`. Seul un administrateur authentifié avec email vérifié peut gérer les catégories, signalements, statuts de boutique et modérations.

## 2. Les 12 Payloads Adversariaux (« Dirty Dozen »)

1. **Escalade de privilèges Admin à l'inscription** : `POST /users/u1` avec `roles: ['client', 'admin']`. -> `PERMISSION_DENIED`.
2. **Escalade de privilèges Admin par mise à jour profil** : `UPDATE /users/u1` avec `roles: ['client', 'admin']` ou `suspended: false`. -> `PERMISSION_DENIED`.
3. **Lecture PII d'un autre utilisateur** : `GET /users/u2` en tant que `u1`. -> `PERMISSION_DENIED`.
4. **Usurpation d'identité vendeur sur boutique** : `CREATE /stores/s1` avec `ownerId: 'autre_uid'`. -> `PERMISSION_DENIED`.
5. **Auto-certification de boutique** : `UPDATE /stores/s1` avec `verificationStatus: 'verified'` par le propriétaire non-admin. -> `PERMISSION_DENIED`.
6. **Modification du produit d'un concurrent** : `UPDATE /products/p_autre` par un vendeur tiers. -> `PERMISSION_DENIED`.
7. **Injection de prix négatif ou falsifié sur produit** : `CREATE /products/p1` avec `price: -500`. -> `PERMISSION_DENIED`.
8. **Lecture d'une commande tierce (fuite PII)** : `GET /orders/o1` par un utilisateur ni `customerId` ni `sellerId`. -> `PERMISSION_DENIED`.
9. **Modification d'une commande terminée (Terminal State Lock)** : `UPDATE /orders/o1` (où `orderStatus == 'livree'`) par un vendeur non-admin. -> `PERMISSION_DENIED`.
10. **Lecture / Envoi de message hors conversation** : `CREATE /messages/m1` dans `conv_privee` par un utilisateur absent de `participants`. -> `PERMISSION_DENIED`.
11. **Empoisonnement d'ID (ID > 128 chars ou caractères illégaux)** : `CREATE /stores/id$$$...` (>200 chars). -> `PERMISSION_DENIED`.
12. **Usurpation d'email Admin non vérifié (`email_verified: false`)** : Tentative d'action admin avec `token.email == 'support.optigrowth@gmail.com'` et `email_verified: false`. -> `PERMISSION_DENIED`.
