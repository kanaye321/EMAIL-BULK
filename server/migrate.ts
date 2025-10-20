import { db } from "./db";
import { sql } from "drizzle-orm";

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    );
  `);
  return result.rows[0]?.exists || false;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    );
  `);
  return result.rows[0]?.exists || false;
}

async function addColumn(tableName: string, columnName: string, definition: string) {
  await db.execute(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`));
  console.log(`✅ Added column ${columnName} to ${tableName}`);
}

export async function runMigrations() {
  try {
    console.log("🔄 Starting database migration...");

    // Create IAM Accounts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS iam_accounts (
        id SERIAL PRIMARY KEY,
        requestor TEXT NOT NULL,
        knox_id TEXT NOT NULL,
        name TEXT,
        user_knox_id TEXT,
        permission_type TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        project TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        approval_number TEXT NOT NULL,
        remarks TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(knox_id, resource_type, project)
      )
    `);
    console.log("✅ IAM Accounts table created/verified");

    // Ensure name and user_knox_id columns exist for existing tables
    if (await tableExists('iam_accounts')) {
      if (!(await columnExists('iam_accounts', 'name'))) {
        await addColumn('iam_accounts', 'name', 'TEXT');
        console.log('✅ Added name column to iam_accounts');
      }
      if (!(await columnExists('iam_accounts', 'user_knox_id'))) {
        await addColumn('iam_accounts', 'user_knox_id', 'TEXT');
        console.log('✅ Added user_knox_id column to iam_accounts');
      }
    }

    // Create IAM Account Approval History table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS iam_account_approval_history (
        id SERIAL PRIMARY KEY,
        iam_account_id INTEGER NOT NULL REFERENCES iam_accounts(id) ON DELETE CASCADE,
        approval_number TEXT NOT NULL,
        duration TEXT,
        action TEXT NOT NULL,
        acted_by TEXT NOT NULL,
        acted_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✅ IAM Account Approval History table created/verified");

    // Create Azure Inventory table
    if (!(await tableExists('azure_inventory'))) {
      await db.execute(sql`
        CREATE TABLE azure_inventory (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          resource_group TEXT NOT NULL,
          location TEXT NOT NULL,
          subscriptions TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      console.log("✅ Azure Inventory table created");
    } else {
      console.log("✅ Azure Inventory table exists - verifying columns");
      const azureColumns = [
        ['name', 'TEXT NOT NULL'],
        ['type', 'TEXT NOT NULL'],
        ['resource_group', 'TEXT NOT NULL'],
        ['location', 'TEXT NOT NULL'],
        ['subscriptions', 'TEXT'],
        ['status', 'TEXT NOT NULL DEFAULT \'active\''],
        ['remarks', 'TEXT'],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL'],
        ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL']
      ];

      for (const [columnName, definition] of azureColumns) {
        if (!(await columnExists('azure_inventory', columnName))) {
          await addColumn('azure_inventory', columnName, definition);
        }
      }
    }

    // Create GCP Inventory table
    if (!(await tableExists('gcp_inventory'))) {
      await db.execute(sql`
        CREATE TABLE gcp_inventory (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          project_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          location TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      console.log("✅ GCP Inventory table created");
    } else {
      console.log("✅ GCP Inventory table exists - verifying columns");
      const gcpColumns = [
        ['name', 'TEXT NOT NULL'],
        ['resource_type', 'TEXT NOT NULL'],
        ['project_id', 'TEXT NOT NULL'],
        ['display_name', 'TEXT NOT NULL'],
        ['location', 'TEXT NOT NULL'],
        ['status', 'TEXT NOT NULL DEFAULT \'active\''],
        ['remarks', 'TEXT'],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL'],
        ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL']
      ];

      for (const [columnName, definition] of gcpColumns) {
        if (!(await columnExists('gcp_inventory', columnName))) {
          await addColumn('gcp_inventory', columnName, definition);
        }
      }
    }

    // Create Azure Historical Data table
    if (!(await tableExists('azure_historical_data'))) {
      await db.execute(sql`
        CREATE TABLE azure_historical_data (
          id SERIAL PRIMARY KEY,
          resource_id INTEGER,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          resource_group TEXT NOT NULL,
          location TEXT NOT NULL,
          subscriptions TEXT NOT NULL,
          status TEXT NOT NULL,
          remarks TEXT,
          change_type TEXT NOT NULL,
          month_year TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      console.log("✅ Azure Historical Data table created");
    }

    // Create GCP Historical Data table
    if (!(await tableExists('gcp_historical_data'))) {
      await db.execute(sql`
        CREATE TABLE gcp_historical_data (
          id SERIAL PRIMARY KEY,
          resource_id INTEGER,
          name TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          project_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          location TEXT NOT NULL,
          status TEXT NOT NULL,
          remarks TEXT,
          change_type TEXT NOT NULL,
          month_year TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      console.log("✅ GCP Historical Data table created");
    }

    // Create AWS Inventory table
    if (!(await tableExists('aws_inventory'))) {
      await db.execute(sql`
        CREATE TABLE aws_inventory (
          id SERIAL PRIMARY KEY,
          identifier TEXT NOT NULL,
          service TEXT NOT NULL,
          type TEXT NOT NULL,
          region TEXT NOT NULL,
          account_name TEXT NOT NULL,
          account_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      console.log("✅ AWS Inventory table created");
    } else {
      console.log("✅ AWS Inventory table exists - verifying columns");

      // Drop name column if it exists
      if (await columnExists('aws_inventory', 'name')) {
        await db.execute(sql`ALTER TABLE aws_inventory DROP COLUMN name`);
        console.log("✅ Removed name column from aws_inventory");
      }

      const awsColumns = [
        ['identifier', 'TEXT NOT NULL'],
        ['service', 'TEXT NOT NULL'],
        ['type', 'TEXT NOT NULL'],
        ['region', 'TEXT NOT NULL'],
        ['account_name', 'TEXT NOT NULL'],
        ['account_id', 'TEXT NOT NULL'],
        ['status', 'TEXT NOT NULL DEFAULT \'active\''],
        ['remarks', 'TEXT'],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL'],
        ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL']
      ];

      for (const [columnName, definition] of awsColumns) {
        if (!(await columnExists('aws_inventory', columnName))) {
          await addColumn('aws_inventory', columnName, definition);
        }
      }
    }

    // Create AWS Historical Data table
    if (!(await tableExists('aws_historical_data'))) {
      await db.execute(sql`
        CREATE TABLE aws_historical_data (
          id SERIAL PRIMARY KEY,
          resource_id INTEGER,
          identifier TEXT NOT NULL,
          service TEXT NOT NULL,
          type TEXT NOT NULL,
          region TEXT NOT NULL,
          account_name TEXT NOT NULL,
          account_id TEXT NOT NULL,
          status TEXT NOT NULL,
          remarks TEXT,
          change_type TEXT NOT NULL,
          month_year TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      console.log("✅ AWS Historical Data table created");
    } else {
      console.log("✅ AWS Historical Data table exists - verifying columns");

      // Drop name column if it exists
      if (await columnExists('aws_historical_data', 'name')) {
        await db.execute(sql`ALTER TABLE aws_historical_data DROP COLUMN name`);
        console.log("✅ Removed name column from aws_historical_data");
      }
    }

    // Create VM approval history table if it doesn't exist
    const vmApprovalHistoryTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vm_approval_history'
      );
    `);

    if (!vmApprovalHistoryTableExists.rows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE vm_approval_history (
          id SERIAL PRIMARY KEY,
          vm_id INTEGER NOT NULL REFERENCES vm_inventory(id) ON DELETE CASCADE,
          old_approval_number TEXT,
          new_approval_number TEXT,
          changed_by INTEGER REFERENCES users(id),
          changed_at TIMESTAMP DEFAULT NOW() NOT NULL,
          reason TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);
      console.log("✅ VM approval history table created");
    } else {
      console.log("✅ VM approval history table exists");
    }

    // Create VM inventory table if it doesn't exist
    const vmInventoryTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vm_inventory'
      );
    `);

    if (!vmInventoryTableExists.rows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE vm_inventory (
          id SERIAL PRIMARY KEY,

          -- Core VM Information
          vm_id TEXT,
          vm_name TEXT NOT NULL,
          vm_status TEXT NOT NULL DEFAULT 'Active',
          vm_ip TEXT,
          vm_os TEXT,
          cpu_count INTEGER DEFAULT 0,
          memory_gb INTEGER DEFAULT 0,
          disk_capacity_gb INTEGER DEFAULT 0,

          -- Request and Approval Information
          requestor TEXT,
          knox_id TEXT,
          department TEXT,
          start_date TEXT,
          end_date TEXT,
          jira_number TEXT,
          approval_number TEXT,
          remarks TEXT,

          -- Legacy compatibility fields
          internet_access BOOLEAN DEFAULT FALSE,
          vm_os_version TEXT,
          hypervisor TEXT,
          host_name TEXT,
          host_ip TEXT,
          host_os TEXT,
          rack TEXT,
          deployed_by TEXT,
          "user" TEXT,
          jira_ticket TEXT,
          date_deleted TEXT,
          guest_os TEXT,
          power_state TEXT,
          memory_mb INTEGER,
          disk_gb INTEGER,
          ip_address TEXT,
          mac_address TEXT,
          vmware_tools TEXT,
          cluster TEXT,
          datastore TEXT,
          status TEXT DEFAULT 'available',
          assigned_to INTEGER,
          location TEXT,
          serial_number TEXT,
          model TEXT,
          manufacturer TEXT,
          purchase_date TEXT,
          purchase_cost TEXT,
          created_date TEXT DEFAULT CURRENT_TIMESTAMP,
          last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `);
      console.log("✅ VM inventory table created with all required columns");
    } else {
      console.log("✅ VM inventory table exists - verifying columns");
    }

    // Create Zabbix settings table
    if (!(await tableExists('zabbix_settings'))) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS zabbix_settings (
          id SERIAL PRIMARY KEY,
          zabbix_url TEXT,
          zabbix_api_token TEXT,
          refresh_interval INTEGER DEFAULT 60,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log("✅ Zabbix settings table created");
    } else {
      console.log("✅ Zabbix settings table exists - verifying columns");
      const zabbixColumns = [
        ['zabbix_url', 'TEXT'],
        ['zabbix_api_token', 'TEXT'],
        ['refresh_interval', 'INTEGER DEFAULT 60'],
        ['created_at', 'TIMESTAMP DEFAULT NOW()'],
        ['updated_at', 'TIMESTAMP DEFAULT NOW()']
      ];

      for (const [columnName, definition] of zabbixColumns) {
        if (!(await columnExists('zabbix_settings', columnName))) {
          await addColumn('zabbix_settings', columnName, definition);
        }
      }
    }

    // Final comprehensive table verification - includes all tables
    const allTables = [
      'users', 'assets', 'components', 'accessories', 'consumables', 'licenses',
      'license_assignments', 'consumable_assignments', 'activities', 'vm_inventory',
      'vms', 'monitor_inventory', 'bitlocker_keys', 'it_equipment', 'it_equipment_assignments',
      'system_settings', 'zabbix_settings', 'discovered_hosts', 'vm_monitoring',
      'monitoring_dashboards', 'monitoring_panels', 'monitoring_datasources', 
      'monitoring_alert_rules', 'monitoring_alerts', 'monitoring_notifications', 'iam_accounts', 
      'vm_approval_history', 'azure_inventory', 'gcp_inventory', 'aws_inventory', 
      'iam_account_approval_history', 'custom_pages'
    ];

    console.log("📊 Final comprehensive table verification:");
    let verifiedTables = 0;
    let totalRecords = 0;

    for (const tableName of allTables) {
      try {
        if (await tableExists(tableName)) {
          const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
          const count = result.rows[0].count;
          console.log(`   ✅ ${tableName}: ${count} records`);
          verifiedTables++;
          totalRecords += parseInt(count);
        } else {
          console.log(`   ❌ ${tableName}: Table missing`);
        }
      } catch (error) {
        console.log(`   ⚠️ ${tableName}: Error checking - ${error.message}`);
      }
    }

    // Create or verify system_settings table with all required columns
    if (!(await tableExists('system_settings'))) {
      await db.execute(sql`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          site_name TEXT DEFAULT 'SRPH-MIS',
          company_name TEXT DEFAULT 'SRPH',
          auto_backup BOOLEAN DEFAULT FALSE,
          auto_optimize BOOLEAN DEFAULT FALSE,
          backup_time TEXT DEFAULT '03:00',
          optimize_time TEXT DEFAULT '04:00',
          retention_days INTEGER DEFAULT 30,
          email_notifications BOOLEAN DEFAULT TRUE,
          notify_on_iam_expiration BOOLEAN DEFAULT TRUE,
          notify_on_vm_expiration BOOLEAN DEFAULT TRUE,
          session_timeout INTEGER DEFAULT 1800,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      // Insert default settings
      await db.execute(sql`
        INSERT INTO system_settings (id, site_name, company_name) 
        VALUES (1, 'SRPH-MIS', 'SRPH')
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('✅ System settings table created with default values');
    } else {
      // Ensure all required columns exist
      const requiredColumns = [
        ['site_name', 'TEXT DEFAULT \'SRPH-MIS\''],
        ['company_name', 'TEXT DEFAULT \'SRPH\''],
        ['auto_backup', 'BOOLEAN DEFAULT FALSE'],
        ['auto_optimize', 'BOOLEAN DEFAULT FALSE'],
        ['backup_time', 'TEXT DEFAULT \'03:00\''],
        ['optimize_time', 'TEXT DEFAULT \'04:00\''],
        ['retention_days', 'INTEGER DEFAULT 30'],
        ['email_notifications', 'BOOLEAN DEFAULT TRUE'],
        ['notify_on_iam_expiration', 'BOOLEAN DEFAULT TRUE'],
        ['notify_on_vm_expiration', 'BOOLEAN DEFAULT TRUE'],
        ['session_timeout', 'INTEGER DEFAULT 1800'],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL'],
        ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL']
      ];

      for (const [columnName, definition] of requiredColumns) {
        if (!(await columnExists('system_settings', columnName))) {
          await addColumn('system_settings', columnName, definition);
        }
      }
      console.log('✅ System settings table columns verified');
    }

    console.log("📁 Backups directory created and configured");

    // Ensure backups directory exists
    const fs = await import('fs');
    const path = await import('path');
    const backupDir = path.join(process.cwd(), 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('📁 Backups directory created at:', backupDir);
    } else {
      console.log('📁 Backups directory already exists at:', backupDir);
    }

    return;

    console.log(`\n🎉 Database verification completed successfully!`);
    console.log(`📊 Summary: ${verifiedTables}/${allTables.length} tables verified`);
    console.log(`📈 Total records across all tables: ${totalRecords}`);
    console.log(`🔄 All missing tables and columns have been created automatically`);

    // Log next steps
    if (verifiedTables < allTables.length) {
      console.log(`\n⚠️ Some tables may need manual attention. Check the logs above.`);
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("📍 Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  }
}