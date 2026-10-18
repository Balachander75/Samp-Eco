"""
Database initialization and seeding script for Navneet SAMP Enterprise.
Creates all required tables in the new PostgreSQL database and seeds initial
Admin user and master plants.
"""
import sys
import app.models  # noqa: F401 - registers all tables on Base.metadata
from app.database import engine, Base, SessionLocal
from app.models.master import User, Plant, Customer, RefreshToken, LoginAuditLog
from app.auth.security import hash_password
from app.migrations import apply_database_migrations

def init_and_seed():
    print("Applying all migrations and initializing tables...")
    apply_database_migrations()
    print("Database migrations applied successfully!")

    db = SessionLocal()
    try:
        # 1. Seed Plants
        plants_data = [
            {"code": "1505", "name": "1505 - Khaniwade", "location": "Khaniwade, Maharashtra"},
        ]

        for p_info in plants_data:
            existing_plant = db.query(Plant).filter(Plant.code == p_info["code"]).first()
            if not existing_plant:
                plant = Plant(
                    code=p_info["code"],
                    name=p_info["name"],
                    location=p_info["location"],
                    is_active=True,
                    created_by="system",
                )
                db.add(plant)
                print(f"Added plant: {p_info['name']}")
            else:
                print(f"Plant {p_info['code']} already exists.")

        # 2. Seed Admin User
        admin_userid = "Admin"
        admin_email = "parin.dedhia@navneet.com"
        existing_user = db.query(User).filter(
            (User.userid == admin_userid) | (User.email == admin_email)
        ).first()

        if not existing_user:
            admin_user = User(
                name="Administrator",
                userid=admin_userid,
                email=admin_email,
                password_hash=hash_password("Admin123"),
                role="admin",
                sub_role="Super Admin",
                team="Management",
                is_team_head=True,
                plant_code="1505",
                theme_id="emerald",
                is_active=True,
            )
            db.add(admin_user)
            print(f"Created Admin user: {admin_userid} / {admin_email} (Password: Admin123)")
        else:
            # Ensure password is reset to Admin123 and active
            existing_user.password_hash = hash_password("Admin123")
            existing_user.is_active = True
            print(f"Updated existing Admin user: {existing_user.userid}")

        # 3. Seed Sample Customers
        customers_data = [
            {"name": "Navneet Education Limited", "country": "India"},
            {"name": "Oxford University Press", "country": "United Kingdom"},
            {"name": "Pearson Publishing", "country": "United States"},
            {"name": "Cambridge University Press", "country": "United Kingdom"},
            {"name": "McGraw Hill Education", "country": "United States"},
        ]

        for c_info in customers_data:
            existing_customer = db.query(Customer).filter(Customer.name == c_info["name"]).first()
            if not existing_customer:
                customer = Customer(name=c_info["name"], country=c_info["country"])
                db.add(customer)
                print(f"Added customer: {c_info['name']}")

        db.commit()
        print("\nAll database tables and seed records successfully committed!")

    except Exception as e:
        db.rollback()
        print(f"Error during database initialization: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    init_and_seed()
