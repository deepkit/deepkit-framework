import { expect, test } from '@jest/globals';
import { Group, User, UserGroup } from '@deepkit/orm-integration';
import { ReflectionClass, ReflectionKind, ReflectionProperty } from '@deepkit/type';

//User, Group, UserGroup have a relatively complex circular reference with runtime typeof, which makes it a good candidate to check if all parents and refs are correctly set
test('check type structure', () => {
    // const entities = [User, UserCredentials, Group, UserGroup];
    const user = ReflectionClass.from(User);
    const group = ReflectionClass.from(Group);
    const userGroup = ReflectionClass.from(UserGroup);

    expect(userGroup.getProperty('id').isPrimaryKey()).toBe(true);
    expect(userGroup.getProperty('user').isReference()).toBe(true);

    expect(userGroup.getProperty('user').getKind()).toBe(ReflectionKind.class);
    expect(userGroup.getProperty('user').getResolvedReflectionClass().getPrimary()).toBeInstanceOf(ReflectionProperty);
    expect(userGroup.getProperty('group').isReference()).toBe(true);
    expect(userGroup.getProperty('group').getResolvedReflectionClass().getPrimary()).toBeInstanceOf(ReflectionProperty);

    expect(userGroup.type.parent).toBeUndefined();

    const groupsType = user.getProperty('groups').type;
    const userGroupsElementType = user.getProperty('groups').getSubType();
    //due to a change in copyAndSetParent being shallow copy only this is no longer true
    // expect(userGroupsElementType.parent === groupsType).toBe(true);
});
