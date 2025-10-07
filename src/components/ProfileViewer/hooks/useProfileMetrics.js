import { useMemo } from 'react';
import { useTreeStore } from '../../../stores/useTreeStore';
import { familyData, getChildren } from '../../../data/family-data';

const generationNames = [
  'الأول',
  'الثاني',
  'الثالث',
  'الرابع',
  'الخامس',
  'السادس',
  'السابع',
  'الثامن',
];

export const useProfileMetrics = (person) => {
  const treeData = useTreeStore((s) => s.treeData);
  const nodesMap = useTreeStore((s) => s.nodesMap);

  const dataSource = treeData && treeData.length > 0 ? treeData : familyData;

  const father = useMemo(() => {
    if (!person) return null;
    if (person.father_id && treeData.length > 0) {
      return dataSource.find((node) => node.id === person.father_id) || null;
    }
    return nodesMap.get(person.father_id) || null;
  }, [dataSource, nodesMap, person, treeData.length]);

  const mother = useMemo(() => {
    if (!person) return null;
    if (person.mother_id && treeData.length > 0) {
      return dataSource.find((node) => node.id === person.mother_id) || null;
    }
    return null;
  }, [dataSource, person, treeData.length]);

  const children = useMemo(() => {
    if (!person) return [];
    if (treeData.length > 0 && person.gender === 'male') {
      return dataSource.filter((node) => node.father_id === person.id);
    }
    return getChildren(person.id, dataSource) || [];
  }, [dataSource, person, treeData.length]);

  const sortedChildren = useMemo(() => {
    return [...children].sort((a, b) => {
      const orderA = a.sibling_order ?? 999;
      const orderB = b.sibling_order ?? 999;
      return orderA - orderB; // Ascending: 0 = oldest
    });
  }, [children]);

  const descendantsCount = useMemo(() => {
    if (!person) return 0;
    if (treeData.length > 0 && person.descendants_count !== undefined) {
      return person.descendants_count;
    }
    let count = 0;
    const countDescendants = (id) => {
      const kids = dataSource.filter((node) => node.father_id === id);
      count += kids.length;
      kids.forEach((child) => countDescendants(child.id));
    };
    countDescendants(person.id);
    return count;
  }, [dataSource, person, treeData.length]);

  const siblingsCount = useMemo(() => {
    if (!person || !father) return 0;
    const siblings = dataSource.filter((node) => node.father_id === father.id);
    return Math.max(0, siblings.length - 1);
  }, [dataSource, father, person]);

  const generationLabel = useMemo(() => {
    if (!person?.generation) return null;
    return generationNames[person.generation - 1] || person.generation;
  }, [person?.generation]);

  return {
    father,
    mother,
    children: sortedChildren,
    rawChildren: children,
    descendantsCount,
    siblingsCount,
    generationLabel,
  };
};
