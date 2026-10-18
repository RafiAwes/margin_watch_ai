from django.db import migrations, models


def update_agency_manager_to_manager(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(role="AGENCY_MANAGER").update(role="MANAGER")


def reverse_update(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(role="MANAGER").update(role="AGENCY_MANAGER")


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(update_agency_manager_to_manager, reverse_update),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[("MANAGER", "Manager"), ("TEAM_MEMBER", "Team Member")],
                db_index=True,
                default="TEAM_MEMBER",
                max_length=20,
                verbose_name="role",
            ),
        ),
    ]
