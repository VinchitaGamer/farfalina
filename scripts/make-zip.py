import zipfile
import os

source_dir = r"c:\Users\Lenovo\Desktop\floreria"
output_zip = r"c:\Users\Lenovo\Desktop\Floreria_Farfalina_Sistema_Local.zip"

exclude_dirs = {"node_modules", ".git", ".next_temp", ".agents_temp"}
exclude_exts = {".zip", ".tar.gz"}

print("Creando archivo ZIP con compresión óptima...")

with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(source_dir):
        # Remove excluded dirs in place
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if any(file.endswith(ext) for ext in exclude_exts):
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, source_dir)
            zipf.write(full_path, rel_path)

size_mb = os.path.getsize(output_zip) / (1024 * 1024)
print(f"✅ ¡ZIP creado exitosamente!")
print(f"📁 Ubicación: {output_zip}")
print(f"📊 Tamaño: {size_mb:.2f} MB")