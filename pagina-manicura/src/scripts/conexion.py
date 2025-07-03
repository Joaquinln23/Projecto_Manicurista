import mysql.connector

try:
    conexion = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",  # Por defecto XAMPP no tiene contraseña para root
        database="proyecto_manicura"
    )
    if conexion.is_connected():
        print("¡Conexión exitosa a la base de datos!")
    else:
        print("No se pudo conectar a la base de datos.")
except mysql.connector.Error as err:
    print("Error al conectar:", err)
finally:
    if 'conexion' in locals() and conexion.is_connected():
        conexion.close()