# Postman Collection Setup

## Quick Start

### 1. Import Collection
- Open Postman
- Click **Import** → **File** → Select `postman-collection.json`
- Collection "Keyforge API" appears in left sidebar

### 2. Start Testing - Automatic Variable Population

The collection now **automatically extracts and sets variables** from POST responses:

✅ **Create Instance** → Auto-populates `{{instance_id}}`
✅ **Create Organisation** → Auto-populates `{{organisation_id}}`
✅ **Create Password** → Auto-populates `{{password_id}}`

**No manual variable configuration needed!** Just follow the workflow:

```
1. Root → Get API Info
2. Admin Instances → Create Instance
   → instance_id automatically set from response ✓
3. Admin Instances → Get Instance Details (repeat until status="ready")
4. Health → Check VaultWarden Health
5. Organisations → Create Organisation
   → organisation_id automatically set from response ✓
6. Passwords → Create Password
   → password_id automatically set from response ✓
7. Continue with other operations...
```

### 3. Advanced Configuration (Optional)

To override defaults or use custom environments:
- Right-click collection → Edit → Variables tab
- Update `base_url` if needed (default: http://localhost:3000)
- Auto-populated variables will update as you run endpoints

## Collection Structure

```
Keyforge API
├── Root
│   └── Get API Info
├── Admin - Instances
│   ├── Create Instance
│   ├── List All Instances
│   ├── Get Instance Details
│   └── Delete Instance
├── Admin - Deployments
│   ├── List All Deployments
│   ├── Get Deployment Details
│   ├── Get Deployment Events
│   └── Get Deployment Logs
├── Organisations
│   ├── Create Organisation
│   ├── List Organisations
│   └── Get Organisation Details
├── Passwords
│   ├── Create Password
│   ├── List Passwords
│   ├── Get Password Details
│   ├── Update Password
│   └── Delete Password
└── Health
    └── Check VaultWarden Health
```

## Key Features

✅ **Auto-populated variables** - IDs automatically extracted from responses
✅ **17 pre-configured endpoints** - All API operations included
✅ **Post-request scripts** - Streamlined testing workflow
✅ **Example request bodies** - Copy/modify for your use case
✅ **Organized by resource** - Easy to find and test by feature
✅ **Complete documentation** - See TESTING.md for workflows

## Common Tasks

### Test Instance Creation Flow
1. Create Instance (auto-sets `{{instance_id}}`)
2. Poll Get Instance Details until status="ready"
3. Check Health confirms VaultWarden is running

### Test Organisation & Passwords
1. Ensure instance is "ready"
2. Create Organisation (auto-sets `{{organisation_id}}`)
3. Create Password (auto-sets `{{password_id}}`)
4. Get Password Details to verify encryption
5. Update/Delete as needed

### Monitor Deployment
1. After creating instance, check Deployment Details
2. Get Deployment Events to see provisioning steps
3. Get Deployment Logs (filter by level if needed)

## Troubleshooting

**404 Not Found**
- Verify `base_url` is correct
- Confirm resource IDs are updated in variables
- Check instance/organisation/password exists

**503 Service Unavailable**
- Instance/organisation not ready yet
- For instances: wait for provisioning to complete
- Check Health endpoint for status

**400 Bad Request**
- Check JSON syntax in request body
- Verify all required fields are present
- Ensure field values are correct type

**Empty responses**
- Instance may still be provisioning
- Use Get Deployment Events to monitor progress
- Check server logs for errors

## Next Steps

1. **Automate tests** - Add tests to endpoints (Tests tab)
2. **Create environment** - Save different server URLs
3. **Generate reports** - Use Postman's runner feature
4. **API documentation** - Share with team via Postman documentation
5. **CI/CD integration** - Run tests via Newman (CLI)

## Reference

- **API Documentation:** See openapi.yaml
- **Testing Guide:** See TESTING.md
- **Server:** http://localhost:3000
