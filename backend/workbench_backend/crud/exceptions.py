import re
from typing import Any, Optional, Self

from sqlalchemy.exc import IntegrityError


class DBException(Exception):
    pass

class DBNotFoundException(DBException):
    def __init__(self, model: str, id: Any) -> None:
        self.model = model
        self.id = id

class DBDuplicateElementException(DBException):
    _integrity_error_pattern = re.compile(r'DETAIL\:\s+Key \((?P<field>.+?)\)=\((?P<value>.+?)\) already exists')
    def __init__(self, model: str, field: str, value: Any) -> None:
        self.model = model
        self.field = field
        self.value = value

    @classmethod
    def from_integrity_error(cls, model: str, err: IntegrityError) -> Optional[Self]:
        match = cls._integrity_error_pattern.search(str(err))
        if match is not None:
            return cls(model, match['field'], match['value'])
        return None

class CRUDException(Exception):
    pass

class UserNotSetException(CRUDException):
    pass

class InvalidAccess(CRUDException):
    pass
