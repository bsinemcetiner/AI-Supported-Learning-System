from api.routes.courses import upload_material
import inspect
src = inspect.getsource(upload_material)
print('pdf_bytes=pdf_bytes' in src)
print('DEBUG' in src)